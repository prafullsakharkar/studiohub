import { useQuery } from '@tanstack/react-query';
import type React from 'react';
import { useState } from 'react';
import { projectsApi } from '@/api/production/structure';
import { Button } from '@/shared/components/Button';

interface ManagerProps {
  projectId: string;
  projectCode: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * "Bulk add" for a project's shots, assets or tasks: the existing grid manager, opened only once a project is
 * chosen (the legacy lists fell back to a made-up project when none was). The manager is passed in so this
 * module does not import the shots, assets and tasks modules that import it.
 */
export const BulkAddButton: React.FC<{ projectId: string | undefined; noun: string; Manager: React.ComponentType<ManagerProps>; onDone?: () => void }> = ({ projectId, noun, Manager, onDone }) => {
  const [open, setOpen] = useState(false);
  const project = useQuery({ queryKey: projectsApi.keys.detail(projectId ?? ''), queryFn: ({ signal }) => projectsApi.get(projectId as string, signal), enabled: Boolean(projectId) });
  if (!projectId) return null;
  return (
    <>
      <Button size="sm" variant="outline" disabled={!project.data} onClick={() => setOpen(true)}>
        Bulk add {noun}
      </Button>
      {open && project.data && (
        <Manager
          projectId={projectId}
          projectCode={project.data.code}
          isOpen
          onClose={() => {
            setOpen(false);
            onDone?.();
          }}
          onSuccess={onDone}
        />
      )}
    </>
  );
};
