import { describe, expect, it } from 'vitest';
import { loadSample } from '@/test/samples';
import { CATEGORY_CODES, DATA_TYPES, FLAG_STATUSES, FLAG_TYPES, FONT_FAMILIES, LANGUAGES, SELECT_TYPES, THEME_TYPES, TIMEZONES } from '../settings';
import { choicesProblem, evaluateFlag, flagActionsFor, flagProblem, isValueDeletable, isValueEditable, rolloutBucket, valueHint } from '../settingsFlow';
import * as K from '../settingsRowKeys';

type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('settings/_flow.json');
const keys = (o: object) => Object.keys(o).sort();
/** A bare-array body is stored as `{_bare_list, _len, items}`; `_len` is the real length. */
const items = (key: string): any[] => flow[key].body.items ?? flow[key].body;
const count = (key: string): number => flow[key].body._len ?? flow[key].body.length;

describe('row types match the captured responses', () => {
  it.each([
    ['SettingCategory', flow.categories_detail.body, K.CATEGORY_KEYS],
    ['SettingDefinition', flow.definitions_detail.body, K.DEFINITION_KEYS],
    ['SystemSetting', flow.values_detail_locked.body, K.VALUE_KEYS],
    ['FeatureFlag', flow.flags_detail_scheduled.body, K.FLAG_KEYS],
    ['Theme', flow.themes_detail.body, K.THEME_KEYS],
    ['Localization', flow.locales_detail.body, K.LOCALIZATION_KEYS],
    ['Tag (a row)', flow.tags_detail.body, K.TAG_KEYS],
  ])('%s', (_label, row, expected) => {
    expect(keys(row)).toEqual(keys(expected));
  });
  it('a list row has the same keys as its detail', () => {
    expect(keys(items('definitions_list')[0])).toEqual(keys(flow.definitions_detail.body));
    expect(keys(items('flags_list')[0])).toEqual(keys(flow.flags_detail_scheduled.body));
    expect(keys(flow.tags_list.body.results[0])).toEqual(keys(flow.tags_detail.body));
  });
});

describe('the closed lists the forms offer', () => {
  it('category codes, data types, flag types and statuses, theme types, fonts, languages and zones are what the API accepts', () => {
    expect(CATEGORY_CODES).toContain(flow.categories_detail.body.code);
    expect(CATEGORY_CODES).toHaveLength(14); // the 14 words of the backend's choice list (apps/settings/models/category.py)
    expect(new Set(CATEGORY_CODES).size).toBe(14);
    expect(flow.categories_create_bad_code.body.code[0]).toMatch(/not a valid choice/);
    expect(DATA_TYPES).toContain(flow.definitions_detail.body.data_type);
    expect(flow.definitions_create_bad_type.body.data_type[0]).toMatch(/not a valid choice/);
    expect(FLAG_TYPES).toContain(flow.flags_detail_scheduled.body.feature_type);
    expect(flow.flags_create_bad_type.body.feature_type[0]).toMatch(/not a valid choice/);
    expect(FLAG_STATUSES).toContain(flow.flags_detail_scheduled.body.status);
    expect(THEME_TYPES).toContain(flow.themes_detail.body.theme_type);
    expect(flow.themes_create_bad_type.body.theme_type[0]).toMatch(/not a valid choice/);
    expect(FONT_FAMILIES).toContain(flow.themes_detail.body.font_family);
    expect(LANGUAGES).toContain(flow.locales_detail.body.language);
    expect(flow.locales_create_bad_language.body.language[0]).toMatch(/not a valid choice/);
    expect(TIMEZONES).toContain(flow.locales_detail.body.timezone);
    expect(flow.locales_create_bad_zone.body.timezone[0]).toMatch(/not a valid choice/);
  });
});

describe('who may', () => {
  it('the production-admin reads but does not write; a supervisor, an artist and a user with no role read nothing (except the flags)', () => {
    expect(flow.categories_list_padmin.status).toBe(200);
    for (const key of ['categories_create_padmin', 'values_lock_padmin']) expect(flow[key].status).toBe(403);
    for (const key of ['categories_list_supervisor', 'categories_create_supervisor', 'categories_list_artist', 'categories_list_norole', 'definitions_list_artist', 'values_list_artist', 'values_list_norole', 'themes_list_artist', 'locales_list_artist']) expect(flow[key].status).toBe(403);
    for (const key of ['flags_list_artist', 'flags_list_norole', 'flags_detail_artist']) expect(flow[key].status).toBe(200);
    for (const key of ['flags_create_artist', 'flags_enable_artist', 'flags_delete_artist', 'themes_activate_artist', 'locales_activate_artist']) expect(flow[key].status).toBe(403);
  });
});

describe('definitions and values', () => {
  it('a definition has a category and a unique code', () => {
    expect(flow.definitions_create_no_category.body.category).toEqual(['This field is required.']);
    expect(flow.definitions_create_duplicate.body.code[0]).toMatch(/already exists/);
    expect(flow.categories_create_duplicate.body.code[0]).toMatch(/already exists/);
  });
  it('a value is checked against its definition and there is one per definition', () => {
    expect(flow.values_create_duplicate.body.non_field_errors).toEqual(['The fields setting must make a unique set.']);
    expect(flow.values_create_bad_integer.body.value[0]).toMatch(/at least 2 characters/);
    expect(flow.values_patch_invalid.body.value).toEqual(['Must be an integer']);
    expect(flow.values_create_select_bad_choice.body.value).toEqual(['Invalid choice: Banana']);
    expect(flow.values_create_unknown_setting.body.setting[0]).toMatch(/object does not exist/);
  });
  it('a select definition needs {value, label} choices: plain strings are a 400 under `choices`, so a value cannot reach a 500 (CR-27)', () => {
    expect(flow.definitions_create_select_strings.status).toBe(400);
    expect(flow.definitions_create_select_strings.body.choices[0]).toMatch(/must be an object with a "value" and a "label"/);
    expect(flow).not.toHaveProperty('values_create_select_with_string_choices');
    expect(flow.values_create_select.status).toBe(201);
    expect(choicesProblem('select', ['Deadline', 'Tractor'])).toMatch(/not a plain string/);
    expect(choicesProblem('select', [])).toMatch(/at least one choice/);
    expect(choicesProblem('select', [{ value: '', label: 'Empty' }])).toMatch(/object with a "value"/);
    expect(choicesProblem('select', [{ value: 'Deadline', label: 'Deadline' }])).toBeUndefined();
    expect(choicesProblem('integer', ['x'])).toBeUndefined();
    for (const type of SELECT_TYPES) expect(choicesProblem(type, undefined)).toBeTruthy();
  });
  it('a locked value cannot be edited or deleted; lock and unlock are idempotent and answer {status}', () => {
    expect(flow.values_lock.body).toEqual({ status: 'locked' });
    expect(flow.values_lock_again.status).toBe(200);
    expect(flow.values_detail_locked.body).toMatchObject({ is_locked: true });
    expect(flow.values_patch_locked.body.value).toEqual(['This setting is locked and cannot be changed.']);
    expect(flow.values_delete_locked.status).toBe(403);
    expect(flow.values_unlock.body).toEqual({ status: 'unlocked' });
    expect(flow.values_unlock_again.status).toBe(200);
    expect(isValueEditable({ is_locked: true }) || isValueDeletable({ is_locked: true })).toBe(false);
    expect(isValueEditable({ is_locked: false }) && isValueDeletable({ is_locked: false })).toBe(true);
  });
  it('a definition code can change after values exist: the form does not offer it', () => {
    expect(flow.definitions_patch_code.status).toBe(200);
    expect(flow.values_detail.body.setting_code).toBe('renamed');
  });
  it('the value hint says what the definition accepts', () => {
    const def = flow.definitions_detail.body;
    expect(valueHint(def)).toMatch(/whole number/);
    expect(valueHint(def)).toMatch(/min 1/);
    expect(valueHint(def)).toMatch(/max 120/);
    expect(valueHint(def)).toMatch(/default 24/);
    expect(valueHint({ data_type: 'select', choices: [{ value: 'A' }, { value: 'B' }], validation_rules: {}, default_value: '' })).toBe('one of: A, B');
  });
});

describe('archive', () => {
  it('answers {status} and sets is_active false; the row stays listed until a filter hides it (CR-26)', () => {
    expect(flow.categories_archive.body).toEqual({ status: 'archived' });
    expect(items('categories_list_after_archive').map((c) => c.is_active)).toContain(false);
    expect(flow.definitions_archive.body).toEqual({ status: 'archived' });
    expect(flow.categories_restore.body).toEqual({ status: 'restored' });
  });
  it('the lists answer their filters (CR-26); a name that is no filter (search, nonsense, category_id) changes nothing', () => {
    for (const [pre, probes] of [
      ['categories', ['is_active', 'code', 'code__icontains']],
      ['definitions', ['category', 'data_type', 'is_active', 'is_required']],
      ['values', ['setting', 'is_locked']],
      ['flags', ['status', 'feature_type', 'is_enabled', 'code', 'code__icontains']],
      ['themes', ['is_active', 'theme_type', 'code', 'code__icontains']],
      ['locales', ['is_active', 'language', 'timezone', 'code__icontains']],
    ] as const) {
      for (const probe of probes) expect(count(`${pre}_by_${probe}`), `${pre} ?${probe}`).toBeLessThan(count(`${pre}_baseline`));
    }
    for (const [pre, probes] of [
      ['categories', ['search', 'nonsense']],
      ['definitions', ['category_id', 'search']],
      ['values', ['search']],
      ['flags', ['search']],
      ['themes', ['search']],
      ['locales', ['search']],
    ] as const) {
      for (const probe of probes) expect(count(`${pre}_by_${probe}`), `${pre} ?${probe}`).toBe(count(`${pre}_baseline`));
    }
  });
});

describe('feature flags', () => {
  it('any signed-in user reads them; the three actions answer {status}', () => {
    expect(flow.flags_list_norole.status).toBe(200);
    expect(flow.flags_enable.body).toEqual({ status: 'enabled' });
    expect(flow.flags_disable.body).toEqual({ status: 'disabled' });
    expect(flow.flags_schedule.body).toEqual({ status: 'scheduled' });
    expect(flow.flags_detail_enabled.body.status).toBe('enabled');
    expect(flow.flags_detail_disabled.body.status).toBe('disabled');
    expect(flow.flags_detail_scheduled.body).toMatchObject({ status: 'scheduled', start_date: '2026-12-01T00:00:00Z' });
  });
  it('`status` is the one source of truth for "on"; `is_enabled` only follows it and cannot be written (Q-21)', () => {
    expect(flow.flags_detail_enabled.body).toMatchObject({ status: 'enabled', is_enabled: true });
    expect(flow.flags_create_is_enabled_true.body).toMatchObject({ status: 'disabled', is_enabled: false });
    expect(flow.flags_patch_is_enabled.body).toMatchObject({ status: 'disabled', is_enabled: false });
    expect(flow.flags_patch_status.body).toMatchObject({ status: 'enabled', is_enabled: true }); // status can also be written directly
  });
  it('the server checks a percentage and the dates (CR-29); the form still checks first so nothing is sent', () => {
    expect(flow.flags_create_bad_percentage.status).toBe(400);
    expect(flow.flags_create_bad_percentage.body.percentage).toEqual(['Percentage must be between 0 and 100.']);
    expect(flow.flags_schedule_empty.body.start_date).toEqual(['This field is required.']);
    expect(flow.flags_schedule_backwards.body.end_date).toEqual(['End must be after the start.']);
    expect(flow.flags_schedule_naive.body.start_date[0]).toMatch(/time zone/);
    expect(flowProblemCases()).toEqual([true, true, true, false]);
    expect(flagProblem({ feature_type: 'percentage', percentage: 150 })?.field).toBe('percentage');
    expect(flagProblem({ start_date: '2027-01-10T00:00:00Z', end_date: '2027-01-01T00:00:00Z' })?.field).toBe('end_date');
  });
  it('the actions offered follow the flag', () => {
    const names = (flag: Parameters<typeof flagActionsFor>[0]) => flagActionsFor(flag).map((a) => a.action);
    expect(names({ status: 'disabled', start_date: null, end_date: null })).toEqual(['enable']);
    expect(names({ status: 'enabled', start_date: null, end_date: null })).toEqual(['disable']);
    expect(names({ status: 'disabled', start_date: '2026-12-01T00:00:00Z', end_date: '2026-12-31T00:00:00Z' })).toEqual(['enable', 'schedule']);
    expect(names({ status: 'scheduled', start_date: '2026-12-01T00:00:00Z', end_date: '2026-12-31T00:00:00Z' })).toEqual(['enable', 'disable']);
  });
  it('a flag is evaluated here: boolean, scheduled window, percentage bucket, expired, unknown', () => {
    const base = { code: 'f', percentage: 0, start_date: null, end_date: null };
    expect(evaluateFlag({ ...base, feature_type: 'boolean', status: 'enabled' }, 'u1')).toBe(true);
    expect(evaluateFlag({ ...base, feature_type: 'boolean', status: 'disabled' }, 'u1')).toBe(false);
    expect(evaluateFlag(undefined, 'u1')).toBe(false);
    expect(evaluateFlag({ ...base, feature_type: 'boolean', status: 'expired' }, 'u1')).toBe(false);
    // the second boolean is not read: what the actions leave in it, or what a create put there, changes nothing
    expect(evaluateFlag({ ...flow.flags_detail_enabled.body }, 'u1')).toBe(true);
    expect(evaluateFlag({ ...flow.flags_create_is_enabled_true.body }, 'u1')).toBe(false);
    const scheduled = { ...base, feature_type: 'scheduled', status: 'scheduled', start_date: '2026-12-01T00:00:00Z', end_date: '2026-12-31T00:00:00Z' };
    expect(evaluateFlag(scheduled, 'u1', new Date('2026-11-30T23:59:59Z'))).toBe(false);
    expect(evaluateFlag(scheduled, 'u1', new Date('2026-12-15T00:00:00Z'))).toBe(true);
    expect(evaluateFlag(scheduled, 'u1', new Date('2026-12-31T00:00:00Z'))).toBe(false); // the end is not included
    const pct = (percentage: number) => ({ ...base, code: 'fast_search', feature_type: 'percentage', status: 'enabled', percentage });
    expect(evaluateFlag(pct(0), 'u1')).toBe(false);
    expect(evaluateFlag(pct(100), 'u1')).toBe(true);
  });
  it('a rollout puts the same person in the same bucket, and about the right share of people under the percentage', () => {
    expect(rolloutBucket('user-1', 'fast_search')).toBe(rolloutBucket('user-1', 'fast_search'));
    const inside = Array.from({ length: 2000 }, (_, i) => rolloutBucket(`user-${i}`, 'fast_search')).filter((b) => b < 25).length;
    expect(inside).toBeGreaterThan(400);
    expect(inside).toBeLessThan(600);
  });
});

function flowProblemCases() {
  return [
    Boolean(flagProblem({ feature_type: 'percentage', percentage: 150 })),
    Boolean(flagProblem({ feature_type: 'rollout', percentage: -1 })),
    Boolean(flagProblem({ start_date: '2027-01-10T00:00:00Z', end_date: '2027-01-01T00:00:00Z' })),
    Boolean(flagProblem({ feature_type: 'percentage', percentage: 25, start_date: '2026-12-01T00:00:00Z', end_date: '2026-12-31T00:00:00Z' })),
  ];
}

describe('themes and localizations', () => {
  it('activating one leaves the others active, and answers {status}', () => {
    expect(flow.themes_activate.body).toEqual({ status: 'activated' });
    expect(items('themes_list_after_activate').filter((t) => t.is_active).length).toBeGreaterThan(1);
    expect(items('locales_list_after_activate').filter((l) => l.is_active).length).toBeGreaterThan(1);
    expect(flow.themes_deactivate_again.status).toBe(200);
  });
  it('a week start is 0 or 1, and the last active theme cannot be deleted (CR-29)', () => {
    expect(flow.locales_create_bad_week.body.week_start).toEqual(['Week start is 0 (Sunday) or 1 (Monday).']);
    expect(flow.themes_delete_active.status).toBe(400);
    expect(flow.themes_delete_active.body.detail).toMatch(/last active theme/);
  });
  it('a colour is checked for length here, and as hex by the form (the capture sends a long word)', () => {
    expect(flow.themes_create_bad_color.body.primary_color[0]).toMatch(/no more than 7 characters/);
  });
});

describe('tags', () => {
  it('are read by anyone signed in and written by holders of settings.manage only (CR-28)', () => {
    expect(flow.tags_list.status).toBe(200);
    for (const key of ['tags_create_artist', 'tags_create_norole', 'tags_create_system_by_artist', 'tags_patch_artist', 'tags_patch_system_by_artist', 'tags_delete_system_by_artist']) {
      expect(flow[key].status, key).toBe(403);
    }
    expect(flow.tags_create.status).toBe(201);
    expect(flow.tags_create_system.body.is_system).toBe(true);
    expect(flow.tags_patch_is_system.status).toBe(200);
  });
  it('a colour is hex, and a create answers the id', () => {
    expect(flow.tags_create_bad_color.body.color).toEqual(['Enter a hex colour such as #3366ff.']);
    expect(flow.tags_create.body.id).toBe(flow.tags_create.body.uuid);
  });
  it('the list is paginated; a name is unique', () => {
    expect(flow.tags_list.body).toHaveProperty('results');
    expect(flow.tags_create_duplicate.body.name).toEqual(['Tag with this name already exists.']);
    expect(flow.tags_detail_deleted.status).toBe(404);
  });
});
