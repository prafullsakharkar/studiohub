import type React from 'react';
import { useState } from 'react';
import { useCan } from '@/core/permissions/useCan';
import { useProductionStore } from '@/core/production/useProductionStore';
import { WorkspaceOverflowMenu } from '@/shared/workspace/canonical/WorkspaceOverflowMenu';
import { useProject } from '../hooks/useProjects';
import { isEpisodicProject } from '../projectWorkflow';
import { ProjectPicker } from '../work/pickers';
import { BulkImportDialog } from './BulkImportDialog';
import type { BulkMode, BulkSpec } from './specs';

interface BulkMenuProps {
  spec: BulkSpec;
  /** The list's project (its Project filter, or the project tab). */
  projectId: string | undefined;
  /** On a project tab the project is fixed; elsewhere the dialog lets the caller choose it. */
  locked?: boolean;
}

/**
 * The "Bulk" menu of a list page (CR-48): bulk create and bulk update of `spec` in one project. On a project's tab the
 * rows go to that project; on the Production lists (Shots, Assets, Tasks, Sequences) the dialog asks for the project,
 * starting from the list's Project filter or the active project. Each entry is offered with its permission (for the
 * list's project, else the active one); the dialog checks the chosen project again, and the backend every row.
 */
export const BulkMenu: React.FC<BulkMenuProps> = ({ spec, projectId, locked = false }) => {
  const [mode, setMode] = useState<BulkMode | null>(null);
  const canCreate = useCan(spec.createPermission, { projectId });
  const canUpdate = useCan(spec.updatePermission, { projectId });
  if (locked && !projectId) return null;
  if (!(canCreate || canUpdate)) return null;
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
      {mode && <BulkDialogHost spec={spec} mode={mode} initialProjectId={projectId} locked={locked} onClose={() => setMode(null)} />}
    </>
  );
};

const BulkDialogHost: React.FC<{ spec: BulkSpec; mode: BulkMode; initialProjectId: string | undefined; locked: boolean; onClose: () => void }> = ({
  spec,
  mode,
  initialProjectId,
  locked,
  onClose,
}) => {
  const activeProjectId = useProductionStore((s) => s.activeProjectId) || undefined;
  const [projectId, setProjectId] = useState(initialProjectId ?? activeProjectId);
  const project = useProject(projectId);
  const permission = mode === 'create' ? spec.createPermission : spec.updatePermission;
  // Read only once a project is chosen (`ready`): without one useCan would answer for the active project.
  const allowed = useCan(permission, { projectId });
  const ready = Boolean(projectId && project.data);
  return (
    <BulkImportDialog
      // A new project starts over: its columns (the episode one) and its codes differ.
      key={projectId ?? ''}
      spec={spec}
      mode={mode}
      projectId={ready ? projectId : undefined}
      projectCode={ready ? project.data?.code : undefined}
      episodic={Boolean(project.data && isEpisodicProject(project.data))}
      projectPicker={locked ? undefined : <ProjectPicker label="Project" required value={projectId ?? null} onChange={(id) => setProjectId(id ?? undefined)} />}
      blocked={ready && !allowed ? `You cannot ${mode} ${spec.plural} in ${project.data?.code}.` : undefined}
      onClose={onClose}
    />
  );
};
