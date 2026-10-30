import { apiClient } from '@/api/client/ApiClient';
import { resourceApi } from '@/api/masterdata/resource';

/**
 * System settings (platform-global): categories, definitions, values, feature flags, themes and localizations, plus
 * the tags of `core`. Row types are pinned to docs/sync/samples/settings/_flow.json (see backend-change-requests.md,
 * "Phase 11 findings").
 *
 * Rules the capture established:
 *  - ids are uuids (`id` equals `uuid`); every list is a bare array except tags (paginated);
 *  - `settings.view` reads (the platform administrator and the production-admin hold it), `settings.manage` writes
 *    (the platform administrator); feature flags are readable by any signed-in user;
 *  - the lists ignore their filters (CR-26): the screens narrow them in the browser;
 *  - a setting's value is always a string, checked against its definition; a locked value cannot change or go;
 *  - a select definition's `choices` must be `{value, label}` objects (plain strings make a later 500, CR-27);
 *  - activating a theme or a localization does not deactivate the others;
 *  - a feature flag's rollout is not computed by the server: `evaluateFlag` (`settingsFlow.ts`) does it;
 *  - every action (lock, enable, archive, activate, …) answers `{status}`, not the row: read the row again.
 */
const V1 = '/api/v1/settings';

/** The fixed words a category's `code` may be. */
export const CATEGORY_CODES = ['general', 'project', 'media', 'workflow', 'review', 'delivery', 'notification', 'billing', 'branding', 'analytics', 'ai', 'localization', 'theme', 'security'] as const;
export const DATA_TYPES = ['string', 'integer', 'float', 'boolean', 'date', 'datetime', 'json', 'text', 'email', 'url', 'phone', 'color', 'select', 'multiple_select'] as const;
export const SELECT_TYPES = ['select', 'multiple_select'] as const;
export const FLAG_TYPES = ['boolean', 'percentage', 'scheduled', 'rollout'] as const;
export const FLAG_STATUSES = ['enabled', 'disabled', 'scheduled', 'expired'] as const;
export const THEME_TYPES = ['light', 'dark', 'custom'] as const;
export const FONT_FAMILIES = ['sans', 'serif', 'mono'] as const;
export const LANGUAGES = ['en', 'hi', 'es', 'fr', 'de', 'zh', 'ja', 'ko', 'ru', 'ar'] as const;
export const TIMEZONES = ['UTC', 'Asia/Kolkata', 'Asia/Dubai', 'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Los_Angeles', 'Australia/Sydney'] as const;
export const DATE_FORMATS = ['YYYY-MM-DD', 'DD-MM-YYYY', 'MM-DD-YYYY', 'YYYY/MM/DD', 'DD/MM/YYYY', 'MM/DD/YYYY'] as const;
export const TIME_FORMATS = ['24H', '12H'] as const;
export const NUMBER_FORMATS = [
  { value: 'dot', label: '1,234.56' },
  { value: 'comma', label: '1.234,56' },
] as const;

// ------------------------------------------------------------------------------------------------ rows

export interface SettingCategory {
  id: string;
  uuid: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
export interface SettingCategoryInput {
  code: string;
  name: string;
  description?: string;
  icon?: string;
  order?: number;
  is_active?: boolean;
}

export interface SettingDefinition {
  id: string;
  uuid: string;
  code: string;
  name: string;
  description: string;
  category: string;
  category_name: string;
  category_code: string;
  data_type: string;
  scope: string;
  is_required: boolean;
  default_value: string;
  help_text: string;
  order: number;
  is_active: boolean;
  /** min, max, min_length, max_length. */
  validation_rules: Record<string, unknown>;
  /** `{value, label}` objects for a select type; anything else is a 500 later (CR-27). */
  choices: unknown[];
  depends_on: string;
  created_at: string;
  updated_at: string;
}
export interface SettingDefinitionInput {
  code: string;
  name: string;
  category: string;
  data_type: string;
  description?: string;
  is_required?: boolean;
  default_value?: string;
  help_text?: string;
  order?: number;
  is_active?: boolean;
  validation_rules?: Record<string, unknown>;
  choices?: Array<{ value: string; label: string }>;
  depends_on?: string;
}

export interface SystemSetting {
  id: string;
  uuid: string;
  setting: string;
  setting_code: string;
  setting_name: string;
  setting_data_type: string;
  setting_default_value: string;
  value: string;
  is_locked: boolean;
  locked_by: string | null;
  locked_at: string | null;
  created_at: string;
  updated_at: string;
}
export interface SystemSettingInput {
  /** The definition's id; one value per definition. */
  setting: string;
  value: string;
}

export interface FeatureFlag {
  id: string;
  uuid: string;
  code: string;
  name: string;
  description: string;
  feature_type: string;
  status: string;
  is_enabled: boolean;
  percentage: number;
  start_date: string | null;
  end_date: string | null;
  config: Record<string, unknown>;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}
export interface FeatureFlagInput {
  code: string;
  name: string;
  description?: string;
  feature_type?: string;
  is_enabled?: boolean;
  /** 0 to 100; the server does not check (CR-29). */
  percentage?: number;
  start_date?: string | null;
  end_date?: string | null;
  config?: Record<string, unknown>;
}

export interface Theme {
  id: string;
  uuid: string;
  code: string;
  name: string;
  description: string;
  theme_type: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
  surface_color: string;
  text_primary: string;
  text_secondary: string;
  border_color: string;
  font_family: string;
  font_size: number;
  border_radius: number;
  spacing_unit: number;
  sidebar_collapsed: boolean;
  navbar_fixed: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
export type ThemeInput = Partial<Omit<Theme, 'id' | 'uuid' | 'created_at' | 'updated_at' | 'is_active'>> & { code: string; name: string };

export interface Localization {
  id: string;
  uuid: string;
  code: string;
  name: string;
  language: string;
  timezone: string;
  date_format: string;
  time_format: string;
  number_format: string;
  currency_code: string;
  currency_symbol: string;
  week_start: number;
  fiscal_year_start: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
export type LocalizationInput = Partial<Omit<Localization, 'id' | 'uuid' | 'created_at' | 'updated_at' | 'is_active'>> & { code: string; name: string; language: string };

export interface Tag {
  id: string;
  uuid: string;
  name: string;
  description: string;
  color: string;
  is_system: boolean;
  created_by: string | null;
  updated_by: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
}
export interface TagInput {
  name: string;
  description?: string;
  color?: string;
}

// -------------------------------------------------------------------------------------------- the API

const act = <T>(path: string, id: string, action: string, body: Record<string, unknown> = {}) => apiClient.post<T>(`${V1}/${path}/${id}/${action}/`, body);
interface StatusAnswer {
  status: string;
}

export const categoriesApi = {
  ...resourceApi<SettingCategory, SettingCategoryInput>('settings-categories', `${V1}/categories/`),
  /** Sets `is_active` false; the row stays listed (CR-26). */
  archive: (id: string) => act<StatusAnswer>('categories', id, 'archive'),
  restore: (id: string) => act<StatusAnswer>('categories', id, 'restore'),
};
export const definitionsApi = {
  ...resourceApi<SettingDefinition, SettingDefinitionInput>('settings-definitions', `${V1}/definitions/`),
  archive: (id: string) => act<StatusAnswer>('definitions', id, 'archive'),
  restore: (id: string) => act<StatusAnswer>('definitions', id, 'restore'),
};
export const systemSettingsApi = {
  ...resourceApi<SystemSetting, SystemSettingInput>('settings-values', `${V1}/system-settings/`),
  update: (id: string, patch: { value: string }) => apiClient.patch<SystemSetting>(`${V1}/system-settings/${id}/`, patch),
  /** Idempotent; a locked value cannot be edited (400) or deleted (403). The answer is `{status}`, not the row. */
  lock: (id: string) => act<StatusAnswer>('system-settings', id, 'lock'),
  unlock: (id: string) => act<StatusAnswer>('system-settings', id, 'unlock'),
};
export const featureFlagsApi = {
  ...resourceApi<FeatureFlag, FeatureFlagInput>('settings-flags', `${V1}/feature-flags/`),
  /** The answers of the three actions are `{status}`, not the row. */
  enable: (id: string) => act<StatusAnswer>('feature-flags', id, 'enable'),
  disable: (id: string) => act<StatusAnswer>('feature-flags', id, 'disable'),
  /** Both dates with a zone, the end after the start: the server checks none of it (CR-29). */
  schedule: (id: string, start_date: string, end_date: string) => act<StatusAnswer>('feature-flags', id, 'schedule', { start_date, end_date }),
};
export const themesApi = {
  ...resourceApi<Theme, ThemeInput>('settings-themes', `${V1}/themes/`),
  /** Answers `{status}`; the others stay active as they were. */
  activate: (id: string) => act<StatusAnswer>('themes', id, 'activate'),
  deactivate: (id: string) => act<StatusAnswer>('themes', id, 'deactivate'),
};
export const localizationsApi = {
  ...resourceApi<Localization, LocalizationInput>('settings-localizations', `${V1}/localizations/`),
  activate: (id: string) => act<StatusAnswer>('localizations', id, 'activate'),
  deactivate: (id: string) => act<StatusAnswer>('localizations', id, 'deactivate'),
};
/** Paginated (the only paginated route here). A create answers without an id (CR-28). */
export const tagsApi = resourceApi<Tag, TagInput>('core-tags', '/api/v1/core/tags/');
