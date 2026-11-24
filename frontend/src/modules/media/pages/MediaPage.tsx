import type React from 'react';
import { useActiveProjectScope } from '@/core/production/useActiveProjectScope';
import { DirectoryFormPage } from '@/modules/directory/DirectoryFormPage';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { mediaFormConfig, useMediaListConfig } from '@/modules/production/review/media';

/** Media records of the project chosen in the project switcher; with none chosen, of every project. */
export const MediaPage: React.FC = () => <DirectoryListPage config={useMediaListConfig(useActiveProjectScope())} />;

export const MediaFormPage: React.FC = () => <DirectoryFormPage config={mediaFormConfig} />;
