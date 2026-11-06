import type React from 'react';
import { useState } from 'react';
import { useCan } from '@/core/permissions/useCan';
import { useProductionStore } from '@/core/production/useProductionStore';
import { Button } from '@/shared/components/Button';
import { useProject } from '../hooks/useProjects';
import { isEpisodicProject } from '../projectWorkflow';
import { StagedBulkManager } from './StagedBulkManager';
import type { BulkSpec } from './specs';

/**
 * "Bulk add {sequences|assets|tasks}" on a list page, as "Bulk add shots" is on Shots: for the list's project (its
 * Project filter, or the project tab), else the active project; shown with the entity's create permission there.
 */
export const StagedBulkAdd: React.FC<{ spec: BulkSpec; projectId: string | undefined }> = ({ spec, projectId }) => {
  const [open, setOpen] = useState(false);
  const activeProjectId = useProductionStore((s) => s.activeProjectId) || undefined;
  const id = projectId ?? activeProjectId;
  const project = useProject(id);
  const allowed = useCan(spec.createPermission, { projectId: id });
  if (!id || !allowed) return null;
  return (
    <>
      <Button size="sm" variant="outline" disabled={!project.data} onClick={() => setOpen(true)}>
        Bulk add {spec.plural}
      </Button>
      {open && project.data && (
        <StagedBulkManager spec={spec} projectId={id} projectCode={project.data.code} episodic={isEpisodicProject(project.data)} onClose={() => setOpen(false)} />
      )}
    </>
  );
};
