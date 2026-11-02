import { useQuery } from '@tanstack/react-query';
import type React from 'react';
import { Link } from 'react-router-dom';
import { projectsApi } from '@/api/production/structure';
import { QueryBoundary } from '@/components/system/QueryBoundary';
import { Badge } from '@/shared/components/Badge';
import { fetchAllRows } from '@/shared/data/listing';

/**
 * The projects whose `client_name` is this client's name. The projects API has no client filter (a project
 * stores the client as a name, not a reference), so the list is searched by name and then kept only where
 * the name is exactly equal. A renamed client no longer matches its older projects; the tab says so.
 */
export const ProjectsOfClient: React.FC<{ clientName: string }> = ({ clientName }) => {
  const query = useQuery({
    queryKey: [...projectsApi.keys.lists(), 'of-client', clientName],
    queryFn: async ({ signal }) => (await fetchAllRows(projectsApi.list, { search: clientName }, { signal })).filter((p) => p.client_name === clientName),
  });
  const rows = query.data ?? [];

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">Projects are matched to a client by the client name stored on the project.</p>
      <QueryBoundary isLoading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} entityName="projects" isEmpty={rows.length === 0} empty={{ title: 'No projects', description: `No project names "${clientName}" as its client.` }}>
        <ul className="space-y-3" aria-label="Projects">
          {rows.map((project) => (
            <li key={project.id}>
              <Link to={`/projects/${project.id}`} className="block p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-sky-500/40 transition-all">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-white">{project.name}</span>
                  {project.code && <span className="px-1.5 rounded bg-sky-950 font-mono text-[10px] font-bold text-sky-300 border border-sky-500/30">{project.code}</span>}
                  <Badge variant="outline" className="ml-auto">
                    {project.status}
                  </Badge>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </QueryBoundary>
    </div>
  );
};
