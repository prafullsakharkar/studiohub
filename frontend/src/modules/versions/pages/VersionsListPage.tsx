import type React from 'react';
import { useActiveProjectScope } from '@/core/production/useActiveProjectScope';
import { DirectoryFormPage } from '@/modules/directory/DirectoryFormPage';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { versionsFormConfig, useVersionsListConfig } from '@/modules/production/review/versions';

/** Versions of the project chosen in the project switcher (every project with none chosen): filter, change status, publish, make hero. */
export const VersionsListPage: React.FC = () => <DirectoryListPage config={useVersionsListConfig(useActiveProjectScope())} />;

export const VersionFormPage: React.FC = () => <DirectoryFormPage config={versionsFormConfig} />;
