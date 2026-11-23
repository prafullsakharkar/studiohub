import type React from 'react';
import { useProductionStore } from '@/core/production/useProductionStore';
import { DirectoryFormPage } from '@/modules/directory/DirectoryFormPage';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { assetsFormConfig, useAssetsListConfig } from '@/modules/production/work/assets';

/** Assets of the project chosen in the project switcher; with none chosen, of every project. The Bulk menu opens once a project is chosen (CR-48). */
export const AssetsPage: React.FC = () => {
  const projectId = useProductionStore((s) => s.activeProjectId);
  return <DirectoryListPage config={useAssetsListConfig(projectId ? { projectId } : undefined)} />;
};

export const AssetFormPage: React.FC = () => <DirectoryFormPage config={assetsFormConfig} />;
