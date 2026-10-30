import type { FeatureFlag, SettingDefinition } from './settings';
import { SELECT_TYPES } from './settings';

/**
 * Rules for the settings records, from docs/sync/samples/settings/_flow.json (Phase 11). The server decides again;
 * what it does not check (CR-29) is checked here before anything is sent.
 */

// ------------------------------------------------------------------------------------------------ feature flags

/** A stable 0 to 99 for this user and flag: the same person always lands in the same bucket, so a rollout does not flicker. */
export function rolloutBucket(userId: string, code: string): number {
  let hash = 2166136261;
  for (const ch of `${code}:${userId}`) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 100;
}

/**
 * Whether a flag is on for this user at this moment. The flag's `status` is the truth: `enable`, `disable` and `schedule`
 * move it. `is_enabled` is a second stored boolean that nothing moves (`enable` leaves it false; a flag created with
 * `is_enabled: true` is still `status: disabled`), so it is not read (Q-21).
 *  - enabled: on, unless the type is percentage or rollout, when the user's bucket must be under the percentage
 *    (the server does no bucketing);
 *  - scheduled: on from its start to before its end;
 *  - disabled, expired, or a flag nobody defined: off.
 */
export function evaluateFlag(flag: Pick<FeatureFlag, 'feature_type' | 'status' | 'percentage' | 'start_date' | 'end_date' | 'code'> | undefined, userId: string, now: Date = new Date()): boolean {
  if (!flag) return false;
  if (flag.status === 'scheduled') {
    const start = flag.start_date ? new Date(flag.start_date) : null;
    const end = flag.end_date ? new Date(flag.end_date) : null;
    return (!start || now >= start) && (!end || now < end);
  }
  if (flag.status !== 'enabled') return false;
  if (flag.feature_type === 'percentage' || flag.feature_type === 'rollout') return rolloutBucket(userId, flag.code) < flag.percentage;
  return true;
}

export interface FlagActionRule {
  action: 'enable' | 'disable' | 'schedule';
  label: string;
  confirm: string;
  /** Offered when this holds for the flag. */
  when: (flag: Pick<FeatureFlag, 'status' | 'start_date' | 'end_date'>) => boolean;
}
export const FLAG_ACTIONS: ReadonlyArray<FlagActionRule> = [
  { action: 'enable', label: 'Enable', confirm: 'Turn this feature on for everyone it applies to?', when: (f) => f.status !== 'enabled' },
  { action: 'disable', label: 'Disable', confirm: 'Turn this feature off?', when: (f) => f.status === 'enabled' || f.status === 'scheduled' },
  { action: 'schedule', label: 'Schedule', confirm: 'Put this feature on the window set on the flag (it switches on and off by itself)?', when: (f) => f.status !== 'scheduled' && Boolean(f.start_date && f.end_date) },
];
export const flagActionsFor = (flag: Parameters<FlagActionRule['when']>[0]) => FLAG_ACTIONS.filter((a) => a.when(flag));

/** The sentences the server will not give (CR-29), with the field they belong to. `undefined` is fine. */
export function flagProblem(input: { feature_type?: string; percentage?: number | null; start_date?: string | null; end_date?: string | null }): { field: 'percentage' | 'end_date'; message: string } | undefined {
  if ((input.feature_type === 'percentage' || input.feature_type === 'rollout') && input.percentage !== undefined && input.percentage !== null && !(input.percentage >= 0 && input.percentage <= 100)) return { field: 'percentage', message: 'A percentage is between 0 and 100.' };
  if (input.start_date && input.end_date && new Date(input.end_date) <= new Date(input.start_date)) return { field: 'end_date', message: 'The end must be after the start.' };
  return undefined;
}

// ------------------------------------------------------------------------------------------------ definitions and values

export const isSelectType = (dataType: string) => (SELECT_TYPES as readonly string[]).includes(dataType);

/** Why `choices` would later make a 500 (CR-27): a select needs `{value, label}` objects; other types need none. */
export function choicesProblem(dataType: string, choices: unknown): string | undefined {
  if (!isSelectType(dataType)) return undefined;
  if (!Array.isArray(choices) || choices.length === 0) return 'A select needs at least one choice, as {"value": "...", "label": "..."}.';
  const ok = choices.every((c) => c !== null && typeof c === 'object' && typeof (c as { value?: unknown }).value === 'string' && (c as { value: string }).value !== '');
  return ok ? undefined : 'Each choice is an object with a "value" and a "label", not a plain string.';
}

/** What a value of this definition looks like, as a hint on the form. */
export function valueHint(definition: Pick<SettingDefinition, 'data_type' | 'choices' | 'validation_rules' | 'default_value'>): string {
  const parts: string[] = [];
  switch (definition.data_type) {
    case 'boolean':
      parts.push('true or false');
      break;
    case 'integer':
      parts.push('a whole number');
      break;
    case 'float':
      parts.push('a number');
      break;
    case 'json':
      parts.push('JSON');
      break;
    case 'date':
      parts.push('YYYY-MM-DD');
      break;
    case 'select':
    case 'multiple_select': {
      const values = (definition.choices as Array<{ value?: string }>).map((c) => c?.value).filter(Boolean);
      if (values.length) parts.push(`one of: ${values.join(', ')}`);
      break;
    }
    default:
      break;
  }
  const rules = definition.validation_rules as Record<string, number | undefined>;
  for (const key of ['min', 'max', 'min_length', 'max_length'] as const) if (rules?.[key] !== undefined) parts.push(`${key.replace('_', ' ')} ${rules[key]}`);
  if (definition.default_value) parts.push(`default ${definition.default_value}`);
  return parts.join(' · ');
}

/** A locked value cannot be edited or deleted. */
export const isValueEditable = (value: { is_locked: boolean }) => !value.is_locked;
export const isValueDeletable = (value: { is_locked: boolean }) => !value.is_locked;

// ------------------------------------------------------------------------------------------------ themes, localizations

export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
export const isHexColor = (value: string) => HEX_COLOR.test(value);
/** The model documents 0 = Sunday and 1 = Monday; the server accepts any number (CR-29). */
export const WEEK_STARTS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
] as const;
