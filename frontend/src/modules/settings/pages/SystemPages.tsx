import type React from 'react';
import { DirectoryFormPage } from '@/modules/directory/DirectoryFormPage';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { categoryFormConfig, definitionFormConfig, flagFormConfig, localizationFormConfig, tagFormConfig, themeFormConfig, useCategoriesListConfig, useDefinitionsListConfig, useFlagsListConfig, useLocalizationsListConfig, useTagsListConfig, useThemesListConfig, useValuesListConfig, valueFormConfig } from '../records';
import { SystemNav } from '../SystemNav';

/** Every system-settings screen sits under the section navigation. */
const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <>
    <SystemNav />
    {children}
  </>
);
const list = (Page: React.FC): React.FC => () => (
  <Shell>
    <Page />
  </Shell>
);
const form = (config: Parameters<typeof DirectoryFormPage>[0]['config']): React.FC => () => (
  <Shell>
    <DirectoryFormPage config={config} />
  </Shell>
);

export const ValuesPage = list(() => <DirectoryListPage config={useValuesListConfig()} />);
export const ValueFormPage = form(valueFormConfig as never);
export const FlagsPage = list(() => <DirectoryListPage config={useFlagsListConfig()} />);
export const FlagFormPage = form(flagFormConfig as never);
export const ThemesPage = list(() => <DirectoryListPage config={useThemesListConfig()} />);
export const ThemeFormPage = form(themeFormConfig as never);
export const LocalizationsPage = list(() => <DirectoryListPage config={useLocalizationsListConfig()} />);
export const LocalizationFormPage = form(localizationFormConfig as never);
export const CategoriesPage = list(() => <DirectoryListPage config={useCategoriesListConfig()} />);
export const CategoryFormPage = form(categoryFormConfig as never);
export const DefinitionsPage = list(() => <DirectoryListPage config={useDefinitionsListConfig()} />);
export const DefinitionFormPage = form(definitionFormConfig as never);
export const TagsPage = list(() => <DirectoryListPage config={useTagsListConfig()} />);
export const TagFormPage = form(tagFormConfig as never);
