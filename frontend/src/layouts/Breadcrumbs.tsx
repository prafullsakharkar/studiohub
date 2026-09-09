import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home, Film } from 'lucide-react';
import { useProjects } from '@/modules/production/hooks/useProjects';
import { useShots } from '@/modules/shots/hooks/useShots';
import { useAssets } from '@/modules/assets/hooks/useAssets';

export const Breadcrumbs: React.FC = () => {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);

  const { data: projectsData } = useProjects();
  const { data: shotsData } = useShots();
  const { data: assetsData } = useAssets();
  const projects = projectsData?.results ?? [];
  const shots = shotsData?.results ?? [];
  const assets = assetsData?.results ?? [];

  const routeNameMap: Record<string, string> = {
    dashboard: 'Studio Home',
    projects: 'Productions',
    shots: 'Shots & Sequences',
    assets: 'Asset Library',
    tasks: 'Task Board',
    reviews: 'Screening Room',
    publishing: 'USD Publishing',
    deliveries: 'Client Deliveries',
    playlists: 'Review Playlists',
    workflow: 'Pipeline Workflows',
    resources: 'Render Compute',
    timelogs: 'Artist Timelogs',
    calendar: 'Production Calendar',
    media: 'Source Media & Plates',
    attachments: 'Production Attachments',
    clients: 'Client Studios',
    vendors: 'Vendor Partners',
    people: 'Crew Directory',
    departments: 'Disciplines',
    teams: 'Squads',
    offices: 'Studio Hubs',
    workspace: 'Relational Workspace',
    audit: 'Audit Stream',
    testing: 'Enterprise Test Suite',
    settings: 'Pipeline Config',
  };

  // Helper to resolve entity codes and titles in dynamic routes
  const resolveBreadcrumbLabel = (segment: string, prevSegment?: string): { label: string; icon?: React.ReactNode; isProject?: boolean } => {
    if (routeNameMap[segment.toLowerCase()]) {
      return { label: routeNameMap[segment.toLowerCase()] };
    }

    // If following /projects/
    if (prevSegment === 'projects') {
      const project = projects.find((p) => p.id === segment || p.code.toLowerCase() === segment.toLowerCase());
      if (project) {
        return {
          label: `${project.name} [${project.code}]`,
          icon: <Film className="w-3 h-3 text-indigo-400 mr-1 inline" />,
          isProject: true,
        };
      }
    }

    // If following /shots/
    if (prevSegment === 'shots') {
      const shot = shots.find((s) => s.id === segment || s.code.toLowerCase() === segment.toLowerCase());
      if (shot) {
        return { label: `Shot ${shot.code}` };
      }
    }

    // If following /assets/
    if (prevSegment === 'assets') {
      const asset = assets.find((a) => a.id === segment || a.code.toLowerCase() === segment.toLowerCase());
      if (asset) {
        return { label: `Asset ${asset.name}` };
      }
    }

    return { label: segment };
  };

  return (
    <nav aria-label="Breadcrumb Navigation" className="flex items-center space-x-2 text-xs text-slate-400 py-2.5 px-4 lg:px-8 border-b border-slate-800/60 bg-slate-950/30 select-none overflow-x-auto custom-scrollbar">
      <Link
        to="/dashboard"
        className="flex items-center text-slate-400 hover:text-indigo-400 transition-colors shrink-0"
      >
        <Home className="w-3.5 h-3.5 mr-1 text-slate-500" />
        <span className="font-medium">Studio</span>
      </Link>

      {pathnames.map((value, index) => {
        const to = `/${pathnames.slice(0, index + 1).join('/')}`;
        const isLast = index === pathnames.length - 1;
        const prevSegment = index > 0 ? pathnames[index - 1] : undefined;
        const { label, icon, isProject } = resolveBreadcrumbLabel(value, prevSegment);

        return (
          <React.Fragment key={to}>
            <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
            {isLast ? (
              <span className={`font-semibold truncate flex items-center shrink-0 ${isProject ? 'text-indigo-300 font-mono' : 'text-slate-200'}`}>
                {icon}
                {label}
              </span>
            ) : (
              <Link to={to} className="hover:text-indigo-400 transition-colors truncate flex items-center shrink-0">
                {icon}
                <span>{label}</span>
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
