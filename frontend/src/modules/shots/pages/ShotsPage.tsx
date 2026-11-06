import type React from 'react';
import { useProductionStore } from '@/core/production/useProductionStore';
import { DirectoryFormPage } from '@/modules/directory/DirectoryFormPage';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { shotsFormConfig, useShotsListConfig } from '@/modules/production/work/shots';
import { ShotBulkAdd } from '../components/ShotBulkAdd';

/** Shots across the caller's projects. Bulk add opens on the project of the Project filter, else the active project. */
export const ShotsPage: React.FC = () => {
  const config = useShotsListConfig();
  const activeProjectId = useProductionStore((s) => s.activeProjectId) || undefined;
  return <DirectoryListPage config={{ ...config, headerExtra: (filters) => <ShotBulkAdd projectId={filters.project_id ? String(filters.project_id) : activeProjectId} /> }} />;
};

export const ShotFormPage: React.FC = () => <DirectoryFormPage config={shotsFormConfig} />;
