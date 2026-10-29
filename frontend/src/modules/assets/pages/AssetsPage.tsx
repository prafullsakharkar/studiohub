import type React from 'react';
import { DirectoryFormPage } from '@/modules/directory/DirectoryFormPage';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { assetsFormConfig, useAssetsListConfig } from '@/modules/production/work/assets';
import { BulkAddButton } from '@/modules/production/work/BulkAddButton';
import { AssetBulkManager } from '../components/bulk/AssetBulkManager';

/** Assets across the caller's projects. Bulk add opens once a project is chosen. */
export const AssetsPage: React.FC = () => {
  const config = useAssetsListConfig();
  return <DirectoryListPage config={{ ...config, headerExtra: (filters) => <BulkAddButton projectId={filters.project_id ? String(filters.project_id) : undefined} noun="assets" Manager={AssetBulkManager} /> }} />;
};

export const AssetFormPage: React.FC = () => <DirectoryFormPage config={assetsFormConfig} />;
