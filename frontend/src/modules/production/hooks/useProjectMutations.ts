import { useMutation, useQueryClient } from '@tanstack/react-query';
import { projectService } from '../services/ProjectService';
import { Project } from '@/mocks/db/production/projects';
import { PROJECT_QUERY_KEYS } from './useProjects';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';

export function useProjectMutations() {
  const queryClient = useQueryClient();
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
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectService.deleteProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECT_QUERY_KEYS.all });
      addNotification({
        type: 'info',
        title: 'Project Removed',
        message: 'Project has been archived/deleted.',
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
