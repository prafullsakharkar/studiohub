import { useMutation, useQueryClient } from '@tanstack/react-query';
import { projectService } from '../services/ProjectService';
import { Project } from '@/types/production';
import { PROJECT_QUERY_KEYS } from './useProjects';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { useActivityStore } from '@/shared/stores/useActivityStore';

export function useProjectMutations() {
  const queryClient = useQueryClient();
  const recordActivity = useActivityStore((state) => state.recordActivity);
  const addNotification = useNotificationStore((state) => state.addNotification);

  const createMutation = useMutation({
    mutationFn: (data: Partial<Project>) => projectService.createProject(data),
    onSuccess: (newProject) => {
      queryClient.invalidateQueries({ queryKey: PROJECT_QUERY_KEYS.all });
      addNotification({
        type: 'success',
        title: 'Project Created',
        message: `Project ${newProject.name} (${newProject.code}) initialized successfully.`,
      });

      recordActivity({
        action: 'created',
        actionLabel: 'Project Created',
        resourceType: 'project',
        resourceId: newProject.id,
        resourceName: newProject.name,
        resourceCode: newProject.code,
        projectId: newProject.id,
        projectName: newProject.name,
        projectCode: newProject.code,
        description: `Initialized project ${newProject.name} (${newProject.code}) with status ${newProject.status || 'Active'}.`,
        tags: ['Project', 'Creation'],
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Project> }) =>
      projectService.updateProject(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: PROJECT_QUERY_KEYS.all });
      addNotification({
        type: 'success',
        title: 'Project Updated',
        message: `Project ${updated.name} updated.`,
      });

      recordActivity({
        action: 'updated',
        actionLabel: 'Project Updated',
        resourceType: 'project',
        resourceId: updated.id,
        resourceName: updated.name,
        resourceCode: updated.code,
        projectId: updated.id,
        projectName: updated.name,
        projectCode: updated.code,
        description: `Updated project parameters for ${updated.name} (${updated.code}).`,
        tags: ['Project', 'Update'],
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectService.deleteProject(id),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: PROJECT_QUERY_KEYS.all });
      addNotification({
        type: 'info',
        title: 'Project Removed',
        message: 'Project has been archived/deleted.',
      });

      recordActivity({
        action: 'archived',
        actionLabel: 'Project Archived',
        resourceType: 'project',
        resourceId: deletedId,
        projectId: deletedId,
        description: `Archived project ${deletedId} from active production workspace.`,
        tags: ['Project', 'Archive'],
      });
    },
  });

  return {
    createProject: createMutation.mutateAsync,
    updateProject: updateMutation.mutateAsync,
    deleteProject: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
