import type React from 'react';
import { useState } from 'react';
import { useCan } from '@/core/permissions/useCan';
import { WorkspaceOverflowMenu } from '@/shared/workspace/canonical/WorkspaceOverflowMenu';
import { useProject } from '../hooks/useProjects';
import { isEpisodicProject } from '../projectWorkflow';
import { BulkImportDialog } from './BulkImportDialog';
import type { BulkMode } from './BulkImportDialog';
import type { BulkSpec } from './specs';

/**
 * The "Bulk" menu of a list page (CR-48): bulk create and bulk update of `spec` in one project. Offered once the list is
 * on one project (its filter or the project tab), each entry only with its permission for that project. The backend
 * checks every row again.
 */
export const BulkMenu: React.FC<{ spec: BulkSpec; projectId: string | undefined }> = ({ spec, projectId }) => {
  const [mode, setMode] = useState<BulkMode | null>(null);
  const project = useProject(projectId);
  const canCreate = useCan(spec.createPermission, { projectId });
  const canUpdate = useCan(spec.updatePermission, { projectId });
  if (!projectId || !project.data || !(canCreate || canUpdate)) return null;
  return (
    <>
      <WorkspaceOverflowMenu
        triggerVariant="button"
        label="Bulk"
        align="right"
        actions={[
          { id: 'bulk-create', label: `Bulk create ${spec.plural}…`, visible: canCreate, onClick: () => setMode('create') },
          { id: 'bulk-update', label: `Bulk update ${spec.plural}…`, visible: canUpdate, onClick: () => setMode('update') },
        ]}
      />
      {mode && (
        <BulkImportDialog
          spec={spec}
          mode={mode}
          projectId={projectId}
          projectCode={project.data.code}
          episodic={isEpisodicProject(project.data)}
          onClose={() => setMode(null)}
        />
      )}
    </>
  );
};
