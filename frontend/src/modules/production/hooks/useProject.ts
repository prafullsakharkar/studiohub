import { useQuery } from '@tanstack/react-query';
import { projectService } from '../services/ProjectService';
import { PROJECT_QUERY_KEYS } from './useProjects';

export function useProject(id?: string) {
  return useQuery({
    queryKey: id ? PROJECT_QUERY_KEYS.detail(id) : ['projects', 'null'],
    queryFn: () => {
      if (!id) throw new Error('Project ID is required');
      return projectService.getProjectById(id);
    },
    enabled: !!id,
  });
}
