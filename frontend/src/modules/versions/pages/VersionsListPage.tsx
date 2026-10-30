import type React from 'react';
import { DirectoryFormPage } from '@/modules/directory/DirectoryFormPage';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { versionsFormConfig, useVersionsListConfig } from '@/modules/production/review/versions';

/** Versions across the caller's projects: filter, change status, publish, make hero. */
export const VersionsListPage: React.FC = () => <DirectoryListPage config={useVersionsListConfig()} />;

export const VersionFormPage: React.FC = () => <DirectoryFormPage config={versionsFormConfig} />;
