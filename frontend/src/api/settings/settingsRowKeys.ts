/**
 * Exhaustive field lists for the hand-written row types in `settings.ts`. They live here, outside `__tests__`,
 * because tsconfig excludes tests from `tsc`: `Record<keyof T, true>` only fails to compile when this file is
 * compiled. The tests then compare these lists with the captured responses.
 */
import type { FeatureFlag, Localization, SettingCategory, SettingDefinition, SystemSetting, Tag, Theme } from './settings';

export const CATEGORY_KEYS: Record<keyof SettingCategory, true> = { code: true, created_at: true, description: true, icon: true, id: true, is_active: true, name: true, order: true, updated_at: true, uuid: true };
export const DEFINITION_KEYS: Record<keyof SettingDefinition, true> = { category: true, category_code: true, category_name: true, choices: true, code: true, created_at: true, data_type: true, default_value: true, depends_on: true, description: true, help_text: true, id: true, is_active: true, is_required: true, name: true, order: true, scope: true, updated_at: true, uuid: true, validation_rules: true };
export const VALUE_KEYS: Record<keyof SystemSetting, true> = { created_at: true, id: true, is_locked: true, locked_at: true, locked_by: true, setting: true, setting_code: true, setting_data_type: true, setting_default_value: true, setting_name: true, updated_at: true, uuid: true, value: true };
export const FLAG_KEYS: Record<keyof FeatureFlag, true> = { code: true, config: true, created_at: true, created_by: true, description: true, end_date: true, feature_type: true, id: true, is_enabled: true, name: true, percentage: true, start_date: true, status: true, updated_at: true, updated_by: true, uuid: true };
export const THEME_KEYS: Record<keyof Theme, true> = { accent_color: true, background_color: true, border_color: true, border_radius: true, code: true, created_at: true, description: true, font_family: true, font_size: true, id: true, is_active: true, is_default: true, name: true, navbar_fixed: true, primary_color: true, secondary_color: true, sidebar_collapsed: true, spacing_unit: true, surface_color: true, text_primary: true, text_secondary: true, theme_type: true, updated_at: true, uuid: true };
export const LOCALIZATION_KEYS: Record<keyof Localization, true> = { code: true, created_at: true, currency_code: true, currency_symbol: true, date_format: true, fiscal_year_start: true, id: true, is_active: true, is_default: true, language: true, name: true, number_format: true, time_format: true, timezone: true, updated_at: true, uuid: true, week_start: true };
export const TAG_KEYS: Record<keyof Tag, true> = { color: true, created_at: true, created_by: true, deleted_by: true, description: true, id: true, is_system: true, name: true, updated_at: true, updated_by: true, uuid: true };
