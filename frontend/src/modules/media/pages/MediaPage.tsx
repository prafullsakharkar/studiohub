import type React from 'react';
import { DirectoryFormPage } from '@/modules/directory/DirectoryFormPage';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { mediaFormConfig, useMediaListConfig } from '@/modules/production/review/media';

/** Media records across the caller's projects. */
export const MediaPage: React.FC = () => <DirectoryListPage config={useMediaListConfig()} />;

export const MediaFormPage: React.FC = () => <DirectoryFormPage config={mediaFormConfig} />;
