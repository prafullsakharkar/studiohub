import type React from 'react';
import { useProductionStore } from '@/core/production/useProductionStore';
import { DirectoryFormPage } from '@/modules/directory/DirectoryFormPage';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { shotsFormConfig, useShotsListConfig } from '@/modules/production/work/shots';
import { GradeExport } from '../components/GradeExport';
import { GradeImport } from '../components/GradeImport';
import { ShotBulkAdd } from '../components/ShotBulkAdd';

/**
 * Shots of the project chosen in the project switcher; with none chosen, of every project. Bulk add, Import grades (RP-20)
 * and Export grades (RP-27) open on that project, or on the Project filter's when none is chosen.
 */
export const ShotsPage: React.FC = () => {
  const activeProjectId = useProductionStore((s) => s.activeProjectId) || undefined;
  const config = useShotsListConfig(activeProjectId ? { projectId: activeProjectId } : undefined);
  const projectOf = (filters: Record<string, unknown>) => (filters.project_id ? String(filters.project_id) : activeProjectId);
  return (
    <DirectoryListPage
      config={{
        ...config,
        headerExtra: (filters) => (
          <>
            <ShotBulkAdd projectId={projectOf(filters)} />
            <GradeImport projectId={projectOf(filters)} />
            <GradeExport projectId={projectOf(filters)} />
          </>
        ),
      }}
    />
  );
};

export const ShotFormPage: React.FC = () => <DirectoryFormPage config={shotsFormConfig} />;
