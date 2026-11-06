import { useQuery, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '@/api/production/structure';
import { PROJECT_QUERY_KEYS } from './useProjects';

/**
 * The code of a project, for the prefix of a new record's code (`TST_`). `code()` answers at once when the project is
 * loaded and fetches it otherwise, so a form submitted before the lookup finished still gets the prefix.
 */
export function useProjectCode(projectId: string | undefined, enabled = true) {
  const queryClient = useQueryClient();
  const id = projectId ?? '';
  const query = useQuery({ queryKey: PROJECT_QUERY_KEYS.detail(id), queryFn: ({ signal }) => projectsApi.get(id, signal), enabled: enabled && Boolean(id) });
  const code = async (): Promise<string | undefined> => {
    if (!enabled || !id) return undefined;
    if (query.data) return query.data.code;
    return (await queryClient.fetchQuery({ queryKey: PROJECT_QUERY_KEYS.detail(id), queryFn: ({ signal }) => projectsApi.get(id, signal) })).code;
  };
  return { projectCode: query.data?.code, code };
}
