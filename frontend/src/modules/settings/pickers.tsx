import type React from 'react';
import { categoriesApi, definitionsApi } from '@/api/settings/settings';
import type { SettingCategory, SettingDefinition } from '@/api/settings/settings';
import { EntityPicker } from '@/components/forms/EntityPicker';
import type { PickerProps } from '@/modules/directory/pickers';

export const CategoryPicker: React.FC<PickerProps> = ({ label = 'Category', ...p }) => (
  <EntityPicker<SettingCategory> label={label} queryKey={categoriesApi.keys.all} fetchPage={categoriesApi.list} fetchOne={categoriesApi.get} getLabel={(c) => `${c.name} (${c.code})`} {...p} />
);

export const DefinitionPicker: React.FC<PickerProps> = ({ label = 'Setting', ...p }) => (
  <EntityPicker<SettingDefinition> label={label} queryKey={definitionsApi.keys.all} fetchPage={definitionsApi.list} fetchOne={definitionsApi.get} getLabel={(d) => `${d.name} (${d.code})`} {...p} />
);
