import type React from 'react';
import { DirectoryFormPage } from '@/modules/directory/DirectoryFormPage';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { BulkAddButton } from '@/modules/production/work/BulkAddButton';
import { shotsFormConfig, useShotsListConfig } from '@/modules/production/work/shots';
import { ShotBulkManager } from '../components/bulk/ShotBulkManager';

/** Shots across the caller's projects. Bulk add opens once a project is chosen. */
export const ShotsPage: React.FC = () => {
  const config = useShotsListConfig();
  return <DirectoryListPage config={{ ...config, headerExtra: (filters) => <BulkAddButton projectId={filters.project_id ? String(filters.project_id) : undefined} noun="shots" Manager={ShotBulkManager} /> }} />;
};

export const ShotFormPage: React.FC = () => <DirectoryFormPage config={shotsFormConfig} />;
