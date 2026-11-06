import type React from 'react';
import { DirectoryFormPage } from '@/modules/directory/DirectoryFormPage';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { assetsFormConfig, useAssetsListConfig } from '@/modules/production/work/assets';

/** Assets across the caller's projects. The Bulk menu opens once a project is chosen (CR-48). */
export const AssetsPage: React.FC = () => <DirectoryListPage config={useAssetsListConfig()} />;

export const AssetFormPage: React.FC = () => <DirectoryFormPage config={assetsFormConfig} />;
