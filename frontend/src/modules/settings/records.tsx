import { categoriesApi, CATEGORY_CODES, DATA_TYPES, definitionsApi, featureFlagsApi, FLAG_STATUSES, FLAG_TYPES, FONT_FAMILIES, LANGUAGES, localizationsApi, NUMBER_FORMATS, systemSettingsApi, tagsApi, THEME_TYPES, themesApi, TIME_FORMATS, TIMEZONES, DATE_FORMATS } from '@/api/settings/settings';
import type { FeatureFlag, Localization, SettingCategory, SettingDefinition, SystemSetting, Tag, Theme } from '@/api/settings/settings';
import { ApiError } from '@/api/errors/ApiError';
import { choicesProblem, flagActionsFor, flagProblem, isHexColor, isValueDeletable, isValueEditable, isSelectType, WEEK_STARTS } from '@/api/settings/settingsFlow';
import type { DirectoryFormConfig, DirectoryListConfig, FieldDef, RowAction } from '@/modules/directory/types';
import { Badge } from '@/shared/components/Badge';
import { withClientFilters } from '@/shared/data/clientFilters';
import type { ClientFilterRule } from '@/shared/data/clientFilters';
import { formatWhen } from '@/modules/deliveries/format';
import { CategoryPicker, DefinitionPicker } from './pickers';

const options = (values: ReadonlyArray<string>) => values.map((value) => ({ value, label: value }));
const activeOptions = [
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
];

/** The server answers these lists without honouring a filter or a search (CR-26): the little lists are narrowed here. */
const textSearch =
  <T extends object>(...fields: ReadonlyArray<keyof T>): ClientFilterRule<T> =>
  (row, value) =>
    fields.some((field) => String(row[field] ?? '').toLowerCase().includes(value.toLowerCase()));
const boolRule =
  <T extends object>(field: keyof T): ClientFilterRule<T> =>
  (row, value) =>
    String(row[field]) === value;
const sameRule =
  <T extends object>(field: keyof T): ClientFilterRule<T> =>
  (row, value) =>
    String(row[field]) === value;

const truncate = (text: string, length = 60) => (text.length > length ? `${text.slice(0, length)}…` : text);
const swatch = (color: string) => (
  <span className="inline-flex items-center gap-1.5">
    <span aria-hidden="true" className="inline-block w-3.5 h-3.5 rounded border border-slate-700" style={{ backgroundColor: color }} />
    <span className="font-mono text-[11px]">{color}</span>
  </span>
);
/** A refusal made before any request, shaped like the server's own 400 so the form puts it on the field. */
const refuse = (field: string, message: string): never => {
  throw new ApiError(message, 400, { [field]: [message] }, { type: 'VALIDATION', fieldErrors: { [field]: [message] } });
};
const failWith = (field: string, message: string | undefined) => {
  if (message) refuse(field, message);
};

// -------------------------------------------------------------------------------------------- categories

export function useCategoriesListConfig(): DirectoryListConfig<SettingCategory> {
  return {
    title: 'Setting categories',
    noun: 'category',
    subtitle: 'The groups system settings belong to. A code is one of a fixed list of words. Archiving sets the category inactive; it stays listed.',
    queryKey: categoriesApi.keys.lists(),
    fetchPage: withClientFilters(categoriesApi.list, { is_active: boolRule<SettingCategory>('is_active'), search: textSearch<SettingCategory>('code', 'name', 'description') }),
    remove: categoriesApi.remove,
    deleteLabel: 'Delete',
    createPermission: 'settings.manage',
    deletePermission: 'settings.manage',
    managePermission: 'settings.manage',
    rowActions: (row) => [row.is_active ? { label: 'Archive', confirm: `Archive ${row.name}? It is set inactive.`, run: () => categoriesApi.archive(row.id) } : { label: 'Restore', confirm: `Restore ${row.name}?`, run: () => categoriesApi.restore(row.id) }],
    rowName: (row) => row.code,
    defaultOrdering: 'order',
    searchPlaceholder: 'Search code, name',
    basePath: '/settings/system/categories',
    rowLink: () => null,
    filters: [{ key: 'is_active', label: 'State', options: activeOptions }],
    columns: [
      { header: 'Category', cell: (row) => `${row.code} · ${row.name}` },
      { header: 'Icon', cell: (row) => row.icon || '—' },
      { header: 'Order', cell: (row) => row.order },
      { header: 'State', cell: (row) => (row.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="neutral">Inactive</Badge>) },
    ],
  };
}
export const categoryFormFields: ReadonlyArray<FieldDef> = [
  { kind: 'select', name: 'code', label: 'Code', required: true, options: options(CATEGORY_CODES), onlyOnCreate: true, hint: 'One of a fixed list; chosen once.' },
  { kind: 'text', name: 'name', label: 'Name', required: true, maxLength: 255 },
  { kind: 'textarea', name: 'description', label: 'Description' },
  { kind: 'text', name: 'icon', label: 'Icon', maxLength: 50 },
  { kind: 'number', name: 'order', label: 'Order' },
  { kind: 'checkbox', name: 'is_active', label: 'Active', initial: true },
];
export const categoryFormConfig: DirectoryFormConfig<SettingCategory> = {
  noun: 'category',
  basePath: '/settings/system/categories',
  queryKey: categoriesApi.keys.lists(),
  fields: categoryFormFields,
  get: categoriesApi.get,
  create: (input) => categoriesApi.create(input as never),
  update: (id, patch) => categoriesApi.update(id, patch as never),
  afterSavePath: () => '/settings/system/categories',
};

// -------------------------------------------------------------------------------------------- definitions

export function useDefinitionsListConfig(): DirectoryListConfig<SettingDefinition> {
  return {
    title: 'Setting definitions',
    noun: 'setting definition',
    subtitle: 'What can be set: a name, a type, its rules and a default. A value is given to a definition under System settings.',
    queryKey: definitionsApi.keys.lists(),
    fetchPage: withClientFilters(definitionsApi.list, {
      category: sameRule<SettingDefinition>('category'),
      data_type: sameRule<SettingDefinition>('data_type'),
      is_active: boolRule<SettingDefinition>('is_active'),
      search: textSearch<SettingDefinition>('code', 'name', 'description'),
    }),
    remove: definitionsApi.remove,
    deleteLabel: 'Delete',
    createPermission: 'settings.manage',
    deletePermission: 'settings.manage',
    managePermission: 'settings.manage',
    rowActions: (row) => [row.is_active ? { label: 'Archive', confirm: `Archive ${row.name}? It is set inactive.`, run: () => definitionsApi.archive(row.id) } : { label: 'Restore', confirm: `Restore ${row.name}?`, run: () => definitionsApi.restore(row.id) }],
    rowName: (row) => row.code,
    defaultOrdering: 'order',
    searchPlaceholder: 'Search code, name',
    basePath: '/settings/system/definitions',
    rowLink: () => null,
    filters: [
      { key: 'category', label: 'Category', optionsFrom: { queryKey: categoriesApi.keys.all, fetchPage: categoriesApi.list as never, getLabel: ((c: { name: string }) => c.name) as never } },
      { key: 'data_type', label: 'Type', options: options(DATA_TYPES) },
      { key: 'is_active', label: 'State', options: activeOptions },
    ],
    columns: [
      { header: 'Setting', cell: (row) => `${row.code} · ${row.name}` },
      { header: 'Category', cell: (row) => row.category_name },
      { header: 'Type', cell: (row) => row.data_type },
      { header: 'Default', cell: (row) => (row.default_value ? truncate(row.default_value, 30) : '—') },
      { header: 'Required', cell: (row) => (row.is_required ? 'Yes' : '—') },
      { header: 'State', cell: (row) => (row.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="neutral">Inactive</Badge>) },
    ],
  };
}
export const definitionFormFields: ReadonlyArray<FieldDef> = [
  { kind: 'text', name: 'code', label: 'Code', required: true, maxLength: 100, onlyOnCreate: true, hint: 'Unique. Other tools read the setting by this code, so it is chosen once.' },
  { kind: 'text', name: 'name', label: 'Name', required: true, maxLength: 255 },
  { kind: 'entity', name: 'category', label: 'Category', required: true, render: (p) => <CategoryPicker label="Category *" value={p.value} onChange={(id) => p.onChange(id ?? '')} error={p.error} /> },
  { kind: 'select', name: 'data_type', label: 'Type', required: true, options: options(DATA_TYPES), initial: 'string' },
  { kind: 'json', name: 'choices', label: 'Choices', shape: 'array', visibleWhen: (v) => isSelectType(String(v.data_type)), hint: 'Objects, not plain strings: [{"value": "Deadline", "label": "Deadline"}]' },
  { kind: 'text', name: 'default_value', label: 'Default value' },
  { kind: 'checkbox', name: 'is_required', label: 'A value is required' },
  { kind: 'json', name: 'validation_rules', label: 'Validation rules', shape: 'object', hint: 'min, max, min_length, max_length: {"min": 1, "max": 120}' },
  { kind: 'textarea', name: 'description', label: 'Description' },
  { kind: 'text', name: 'help_text', label: 'Help text' },
  { kind: 'number', name: 'order', label: 'Order' },
  { kind: 'checkbox', name: 'is_active', label: 'Active', initial: true },
];
export const definitionFormConfig: DirectoryFormConfig<SettingDefinition> = {
  noun: 'setting definition',
  basePath: '/settings/system/definitions',
  queryKey: definitionsApi.keys.lists(),
  fields: definitionFormFields,
  get: definitionsApi.get,
  create: async (input) => {
    // Plain-string choices are accepted here and then break value creation with a 500 (CR-27).
    failWith('choices', choicesProblem(String(input.data_type), input.choices));
    return definitionsApi.create(input as never);
  },
  update: async (id, patch) => {
    if ('choices' in patch || 'data_type' in patch) {
      const current = await definitionsApi.get(id);
      failWith('choices', choicesProblem(String(patch.data_type ?? current.data_type), 'choices' in patch ? patch.choices : current.choices));
    }
    return definitionsApi.update(id, patch as never);
  },
  afterSavePath: () => '/settings/system/definitions',
};

// -------------------------------------------------------------------------------------------- values

export function useValuesListConfig(): DirectoryListConfig<SystemSetting> {
  return {
    title: 'System settings',
    noun: 'setting',
    subtitle: 'The studio’s configuration. A value is checked against its definition; a locked value cannot be changed or removed until it is unlocked.',
    queryKey: systemSettingsApi.keys.lists(),
    fetchPage: withClientFilters(systemSettingsApi.list, {
      is_locked: boolRule<SystemSetting>('is_locked'),
      setting: sameRule<SystemSetting>('setting'),
      search: textSearch<SystemSetting>('setting_code', 'setting_name', 'value'),
    }),
    remove: systemSettingsApi.remove,
    deleteLabel: 'Remove',
    createPermission: 'settings.manage',
    deletePermission: 'settings.manage',
    managePermission: 'settings.manage',
    canEdit: isValueEditable,
    canRemove: isValueDeletable,
    rowActions: (row) => [row.is_locked ? { label: 'Unlock', confirm: `Unlock ${row.setting_code}? It can be changed again.`, run: () => systemSettingsApi.unlock(row.id) } : { label: 'Lock', confirm: `Lock ${row.setting_code}? Nobody can change or remove it until it is unlocked.`, run: () => systemSettingsApi.lock(row.id) }],
    rowName: (row) => row.setting_code,
    defaultOrdering: 'setting_code',
    searchPlaceholder: 'Search setting or value',
    basePath: '/settings/system/values',
    rowLink: () => null,
    filters: [
      { key: 'setting', label: 'Setting', optionsFrom: { queryKey: definitionsApi.keys.all, fetchPage: definitionsApi.list as never, getLabel: ((d: { code: string }) => d.code) as never } },
      { key: 'is_locked', label: 'Lock', options: [{ value: 'true', label: 'Locked' }, { value: 'false', label: 'Unlocked' }] },
    ],
    columns: [
      { header: 'Setting', cell: (row) => `${row.setting_code} · ${row.setting_name}` },
      { header: 'Type', cell: (row) => row.setting_data_type },
      { header: 'Value', cell: (row) => <span className="font-mono text-xs">{truncate(row.value) || '—'}</span> },
      { header: 'Default', cell: (row) => (row.setting_default_value ? truncate(row.setting_default_value, 30) : '—') },
      { header: 'Lock', cell: (row) => (row.is_locked ? <Badge variant="warning">Locked {row.locked_at ? formatWhen(row.locked_at) : ''}</Badge> : '—') },
    ],
  };
}
export const valueFormFields: ReadonlyArray<FieldDef> = [
  { kind: 'entity', name: 'setting', label: 'Setting', required: true, onlyOnCreate: true, render: (p) => <DefinitionPicker label="Setting *" value={p.value} onChange={(id) => p.onChange(id ?? '')} error={p.error} /> },
  { kind: 'textarea', name: 'value', label: 'Value', required: true, hint: 'Always text: true or false for a boolean, a plain number for a number. The definition’s rules decide what is accepted. One value per setting.' },
];
export const valueFormConfig: DirectoryFormConfig<SystemSetting> = {
  noun: 'setting',
  basePath: '/settings/system/values',
  queryKey: systemSettingsApi.keys.lists(),
  fields: valueFormFields,
  get: systemSettingsApi.get,
  create: (input) => systemSettingsApi.create(input as never),
  update: (id, patch) => systemSettingsApi.update(id, patch as never),
  afterSavePath: () => '/settings/system/values',
};

// -------------------------------------------------------------------------------------------- feature flags

export const flagStatusVariant = (status: string) => (status === 'enabled' ? 'success' : status === 'scheduled' ? 'info' : status === 'expired' ? 'warning' : 'neutral');

export function useFlagsListConfig(): DirectoryListConfig<FeatureFlag> {
  const rowActions = (row: FeatureFlag): RowAction[] =>
    flagActionsFor(row).map((a) => ({
      label: a.label,
      confirm: a.confirm,
      run: () => (a.action === 'enable' ? featureFlagsApi.enable(row.id) : a.action === 'disable' ? featureFlagsApi.disable(row.id) : featureFlagsApi.schedule(row.id, row.start_date as string, row.end_date as string)),
    }));
  return {
    title: 'Feature flags',
    noun: 'feature flag',
    subtitle: 'Switch features on, off or on a schedule. Everyone signed in can read the flags; only administrators change them. A flag is on when its status is Enabled, or inside its window while Scheduled.',
    queryKey: featureFlagsApi.keys.lists(),
    fetchPage: withClientFilters(featureFlagsApi.list, {
      status: sameRule<FeatureFlag>('status'),
      feature_type: sameRule<FeatureFlag>('feature_type'),
      search: textSearch<FeatureFlag>('code', 'name', 'description'),
    }),
    remove: featureFlagsApi.remove,
    deleteLabel: 'Delete',
    createPermission: 'settings.manage',
    deletePermission: 'settings.manage',
    managePermission: 'settings.manage',
    rowActions,
    rowName: (row) => row.code,
    defaultOrdering: 'code',
    searchPlaceholder: 'Search code, name',
    basePath: '/settings/system/flags',
    rowLink: () => null,
    filters: [
      { key: 'status', label: 'Status', options: options(FLAG_STATUSES) },
      { key: 'feature_type', label: 'Type', options: options(FLAG_TYPES) },
    ],
    columns: [
      { header: 'Flag', cell: (row) => `${row.code} · ${row.name}` },
      { header: 'Type', cell: (row) => (row.feature_type === 'percentage' || row.feature_type === 'rollout' ? `${row.feature_type} ${row.percentage}%` : row.feature_type) },
      { header: 'Window', cell: (row) => (row.start_date || row.end_date ? `${row.start_date ? formatWhen(row.start_date) : '…'} – ${row.end_date ? formatWhen(row.end_date) : '…'}` : '—') },
      { header: 'Status', cell: (row) => <Badge variant={flagStatusVariant(row.status)}>{row.status}</Badge> },
    ],
  };
}
export const flagFormFields: ReadonlyArray<FieldDef> = [
  { kind: 'text', name: 'code', label: 'Code', required: true, maxLength: 100, onlyOnCreate: true, hint: 'Unique. The app asks for the flag by this code.' },
  { kind: 'text', name: 'name', label: 'Name', required: true, maxLength: 255 },
  { kind: 'textarea', name: 'description', label: 'Description' },
  { kind: 'select', name: 'feature_type', label: 'Type', options: options(FLAG_TYPES), initial: 'boolean' },
  { kind: 'number', name: 'percentage', label: 'Percentage', visibleWhen: (v) => v.feature_type === 'percentage' || v.feature_type === 'rollout', hint: 'Of users, 0 to 100.' },
  { kind: 'datetime', name: 'start_date', label: 'Starts', hint: 'With Ends, the window the Schedule action puts the flag on.' },
  { kind: 'datetime', name: 'end_date', label: 'Ends' },
  { kind: 'json', name: 'config', label: 'Configuration', shape: 'object' },
];
const checkFlag = (input: Record<string, unknown>) => {
  const problem = flagProblem({ feature_type: input.feature_type as string | undefined, percentage: input.percentage as number | null | undefined, start_date: input.start_date as string | null | undefined, end_date: input.end_date as string | null | undefined });
  if (problem) refuse(problem.field, problem.message);
};
export const flagFormConfig: DirectoryFormConfig<FeatureFlag> = {
  noun: 'feature flag',
  basePath: '/settings/system/flags',
  queryKey: featureFlagsApi.keys.lists(),
  fields: flagFormFields,
  get: featureFlagsApi.get,
  create: async (input) => {
    checkFlag(input); // the server accepts a percentage of 150 and a window that ends before it starts (CR-29)
    return featureFlagsApi.create(input as never);
  },
  update: async (id, patch) => {
    // A patch holds only what changed, so the type and the other end of the window come from the stored flag.
    if ('percentage' in patch || 'feature_type' in patch || 'start_date' in patch || 'end_date' in patch) {
      const current = await featureFlagsApi.get(id);
      checkFlag({ feature_type: current.feature_type, percentage: current.percentage, start_date: current.start_date, end_date: current.end_date, ...patch });
    }
    return featureFlagsApi.update(id, patch as never);
  },
  afterSavePath: () => '/settings/system/flags',
};

// -------------------------------------------------------------------------------------------- themes

export function useThemesListConfig(): DirectoryListConfig<Theme> {
  return {
    title: 'Themes',
    noun: 'theme',
    subtitle: 'Colours and type for the app. Activating a theme does not deactivate the others: several can be active at once.',
    queryKey: themesApi.keys.lists(),
    fetchPage: withClientFilters(themesApi.list, { theme_type: sameRule<Theme>('theme_type'), is_active: boolRule<Theme>('is_active'), search: textSearch<Theme>('code', 'name', 'description') }),
    remove: themesApi.remove,
    deleteLabel: 'Delete',
    createPermission: 'settings.manage',
    deletePermission: 'settings.manage',
    managePermission: 'settings.manage',
    rowActions: (row) => [row.is_active ? { label: 'Deactivate', confirm: `Deactivate ${row.name}?`, run: () => themesApi.deactivate(row.id) } : { label: 'Activate', confirm: `Activate ${row.name}? Other active themes stay active.`, run: () => themesApi.activate(row.id) }],
    rowName: (row) => row.code,
    defaultOrdering: 'name',
    searchPlaceholder: 'Search code, name',
    basePath: '/settings/system/themes',
    rowLink: () => null,
    filters: [
      { key: 'theme_type', label: 'Type', options: options(THEME_TYPES) },
      { key: 'is_active', label: 'State', options: activeOptions },
    ],
    columns: [
      { header: 'Theme', cell: (row) => `${row.code} · ${row.name}` },
      { header: 'Type', cell: (row) => row.theme_type },
      { header: 'Primary', cell: (row) => swatch(row.primary_color) },
      { header: 'Background', cell: (row) => swatch(row.background_color) },
      { header: 'Font', cell: (row) => `${row.font_family} ${row.font_size}px` },
      { header: 'State', cell: (row) => (row.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="neutral">Inactive</Badge>) },
    ],
  };
}
const COLOR_FIELDS = [
  ['primary_color', 'Primary colour'],
  ['secondary_color', 'Secondary colour'],
  ['accent_color', 'Accent colour'],
  ['background_color', 'Background colour'],
  ['surface_color', 'Surface colour'],
  ['text_primary', 'Text colour'],
  ['text_secondary', 'Secondary text colour'],
  ['border_color', 'Border colour'],
] as const;
export const themeFormFields: ReadonlyArray<FieldDef> = [
  { kind: 'text', name: 'code', label: 'Code', required: true, maxLength: 50, onlyOnCreate: true },
  { kind: 'text', name: 'name', label: 'Name', required: true, maxLength: 255 },
  { kind: 'textarea', name: 'description', label: 'Description' },
  { kind: 'select', name: 'theme_type', label: 'Type', options: options(THEME_TYPES), initial: 'custom' },
  ...COLOR_FIELDS.map(([name, label]) => ({ kind: 'text' as const, name, label, maxLength: 7, hint: 'A hex colour such as #06b6d4.' })),
  { kind: 'select', name: 'font_family', label: 'Font', options: options(FONT_FAMILIES), initial: 'sans' },
  { kind: 'number', name: 'font_size', label: 'Font size (px)' },
  { kind: 'number', name: 'border_radius', label: 'Corner radius (px)' },
  { kind: 'number', name: 'spacing_unit', label: 'Spacing unit (px)' },
  { kind: 'checkbox', name: 'sidebar_collapsed', label: 'Sidebar collapsed' },
  { kind: 'checkbox', name: 'navbar_fixed', label: 'Navbar fixed', initial: true },
];
/** The server only checks a colour's length (CR-29). */
const checkColors = (input: Record<string, unknown>) => {
  for (const [name, label] of COLOR_FIELDS) {
    const value = input[name];
    if (typeof value === 'string' && value !== '' && !isHexColor(value)) refuse(name, `${label} must be a hex colour such as #06b6d4.`);
  }
};
export const themeFormConfig: DirectoryFormConfig<Theme> = {
  noun: 'theme',
  basePath: '/settings/system/themes',
  queryKey: themesApi.keys.lists(),
  fields: themeFormFields,
  get: themesApi.get,
  create: async (input) => {
    checkColors(input);
    return themesApi.create(input as never);
  },
  update: async (id, patch) => {
    checkColors(patch);
    return themesApi.update(id, patch as never);
  },
  afterSavePath: () => '/settings/system/themes',
};

// -------------------------------------------------------------------------------------------- localizations

export function useLocalizationsListConfig(): DirectoryListConfig<Localization> {
  return {
    title: 'Localizations',
    noun: 'localization',
    subtitle: 'Language, time zone and formats. Activating one does not deactivate the others.',
    queryKey: localizationsApi.keys.lists(),
    fetchPage: withClientFilters(localizationsApi.list, { language: sameRule<Localization>('language'), timezone: sameRule<Localization>('timezone'), is_active: boolRule<Localization>('is_active'), search: textSearch<Localization>('code', 'name') }),
    remove: localizationsApi.remove,
    deleteLabel: 'Delete',
    createPermission: 'settings.manage',
    deletePermission: 'settings.manage',
    managePermission: 'settings.manage',
    rowActions: (row) => [row.is_active ? { label: 'Deactivate', confirm: `Deactivate ${row.name}?`, run: () => localizationsApi.deactivate(row.id) } : { label: 'Activate', confirm: `Activate ${row.name}? Other active localizations stay active.`, run: () => localizationsApi.activate(row.id) }],
    rowName: (row) => row.code,
    defaultOrdering: 'name',
    searchPlaceholder: 'Search code, name',
    basePath: '/settings/system/localizations',
    rowLink: () => null,
    filters: [
      { key: 'language', label: 'Language', options: options(LANGUAGES) },
      { key: 'timezone', label: 'Time zone', options: options(TIMEZONES) },
      { key: 'is_active', label: 'State', options: activeOptions },
    ],
    columns: [
      { header: 'Localization', cell: (row) => `${row.code} · ${row.name}` },
      { header: 'Language', cell: (row) => row.language },
      { header: 'Time zone', cell: (row) => row.timezone },
      { header: 'Dates', cell: (row) => `${row.date_format} · ${row.time_format}` },
      { header: 'Currency', cell: (row) => `${row.currency_symbol} ${row.currency_code}`.trim() || '—' },
      { header: 'State', cell: (row) => (row.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="neutral">Inactive</Badge>) },
    ],
  };
}
export const localizationFormFields: ReadonlyArray<FieldDef> = [
  { kind: 'text', name: 'code', label: 'Code', required: true, maxLength: 20, onlyOnCreate: true },
  { kind: 'text', name: 'name', label: 'Name', required: true, maxLength: 255 },
  { kind: 'select', name: 'language', label: 'Language', required: true, options: options(LANGUAGES), initial: 'en' },
  { kind: 'select', name: 'timezone', label: 'Time zone', options: options(TIMEZONES), initial: 'UTC' },
  { kind: 'select', name: 'date_format', label: 'Date format', options: options(DATE_FORMATS), initial: 'YYYY-MM-DD' },
  { kind: 'select', name: 'time_format', label: 'Time format', options: options(TIME_FORMATS), initial: '24H' },
  { kind: 'select', name: 'number_format', label: 'Number format', options: NUMBER_FORMATS.map((f) => ({ value: f.value, label: f.label })), initial: 'dot' },
  { kind: 'text', name: 'currency_code', label: 'Currency code', maxLength: 3, hint: 'ISO 4217, e.g. GBP.' },
  { kind: 'text', name: 'currency_symbol', label: 'Currency symbol', maxLength: 5 },
  { kind: 'select', name: 'week_start', label: 'Week starts on', options: WEEK_STARTS.map((d) => ({ value: String(d.value), label: d.label })), initial: '1' },
  { kind: 'date', name: 'fiscal_year_start', label: 'Fiscal year starts' },
];
export const localizationFormConfig: DirectoryFormConfig<Localization> = {
  noun: 'localization',
  basePath: '/settings/system/localizations',
  queryKey: localizationsApi.keys.lists(),
  fields: localizationFormFields,
  get: localizationsApi.get,
  // A select field sends text; the week start is a number.
  create: (input) => localizationsApi.create({ ...input, ...('week_start' in input ? { week_start: Number(input.week_start) } : {}) } as never),
  update: (id, patch) => localizationsApi.update(id, { ...patch, ...('week_start' in patch ? { week_start: Number(patch.week_start) } : {}) } as never),
  afterSavePath: () => '/settings/system/localizations',
};

// -------------------------------------------------------------------------------------------- tags

export function useTagsListConfig(): DirectoryListConfig<Tag> {
  return {
    title: 'Tags',
    noun: 'tag',
    subtitle: 'Labels used across the studio. The tags route has no permission check of its own (CR-28): this screen is offered to settings administrators.',
    queryKey: tagsApi.keys.lists(),
    fetchPage: tagsApi.list,
    remove: tagsApi.remove,
    deleteLabel: 'Delete',
    createPermission: 'settings.manage',
    deletePermission: 'settings.manage',
    managePermission: 'settings.manage',
    rowName: (row) => row.name,
    defaultOrdering: 'name',
    searchPlaceholder: 'Search name, description',
    basePath: '/settings/system/tags',
    rowLink: () => null,
    columns: [
      { header: 'Tag', cell: (row) => <span className="inline-flex items-center gap-1.5">{row.color ? swatch(row.color) : null}<span>{row.name}</span></span> },
      { header: 'Description', cell: (row) => row.description || '—' },
      { header: 'System', cell: (row) => (row.is_system ? <Badge variant="info">System</Badge> : '—') },
    ],
  };
}
export const tagFormFields: ReadonlyArray<FieldDef> = [
  { kind: 'text', name: 'name', label: 'Name', required: true, maxLength: 255, hint: 'Unique.' },
  { kind: 'textarea', name: 'description', label: 'Description' },
  { kind: 'text', name: 'color', label: 'Colour', maxLength: 7, hint: 'A hex colour such as #f59e0b.' },
];
export const tagFormConfig: DirectoryFormConfig<Tag> = {
  noun: 'tag',
  basePath: '/settings/system/tags',
  queryKey: tagsApi.keys.lists(),
  fields: tagFormFields,
  get: tagsApi.get,
  create: async (input) => {
    if (typeof input.color === 'string' && input.color !== '' && !isHexColor(input.color)) refuse('color', 'The colour must be a hex colour such as #f59e0b.');
    // The create answers without an id (CR-28): find the tag by its name to go on.
    await tagsApi.create(input as never);
    const found = (await tagsApi.list({ search: String(input.name) })).results.find((t) => t.name === input.name);
    return (found ?? ({ id: '' } as Tag)) as Tag;
  },
  update: async (id, patch) => {
    if (typeof patch.color === 'string' && patch.color !== '' && !isHexColor(patch.color)) refuse('color', 'The colour must be a hex colour such as #f59e0b.');
    return tagsApi.update(id, patch as never);
  },
  afterSavePath: () => '/settings/system/tags',
};
