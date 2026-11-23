import type React from 'react';
import { useActiveProjectScope } from '@/core/production/useActiveProjectScope';
import { DirectoryFormPage } from '@/modules/directory/DirectoryFormPage';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { assetsFormConfig, useAssetsListConfig } from '@/modules/production/work/assets';

/** Assets of the project chosen in the project switcher; with none chosen, of every project. The Bulk menu opens once a project is chosen (CR-48). */
export const AssetsPage: React.FC = () => <DirectoryListPage config={useAssetsListConfig(useActiveProjectScope())} />;

export const AssetFormPage: React.FC = () => <DirectoryFormPage config={assetsFormConfig} />;
