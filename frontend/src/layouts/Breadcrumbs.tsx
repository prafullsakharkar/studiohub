import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home, Film } from 'lucide-react';
import { resolveEntity } from '@/core/workspace/entityRegistry';
import type { UniversalEntityType } from '@/types/workspace';

export const Breadcrumbs: React.FC = () => {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);

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

    // Resolve entity labels through the centralized workspace entity resolver.
    // This keeps presentation free of direct mock-database imports: the resolver
    // is the single data-source boundary (mock adapter in mock mode, REST in live).
    const segmentToEntityType: Record<string, UniversalEntityType> = {
      projects: 'project',
      shots: 'shot',
      assets: 'asset',
    };
    const entityType = prevSegment ? segmentToEntityType[prevSegment] : undefined;
    if (entityType) {
      try {
        const resolved = resolveEntity(entityType, segment);
        if (resolved) {
          if (entityType === 'project') {
            return {
              label: `${resolved.title} [${resolved.code}]`,
              icon: <Film className="w-3 h-3 text-indigo-400 mr-1 inline" />,
              isProject: true,
            };
          }
          if (entityType === 'shot') {
            return { label: `Shot ${resolved.code}` };
          }
          if (entityType === 'asset') {
            return { label: `Asset ${resolved.title}` };
          }
          return { label: `${resolved.title}` };
        }
      } catch {
        // Fall through to humanized segment label.
      }
    }

    return { label: segment };
  };

  return (
    <nav aria-label="Breadcrumb Navigation" className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 py-2.5 px-4 lg:px-8 border-b border-slate-200 dark:border-slate-800/60 bg-white/80 dark:bg-slate-950/30 backdrop-blur-xs select-none overflow-x-auto custom-scrollbar">
      <Link
        to="/dashboard"
        className="flex items-center text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors shrink-0"
      >
        <Home className="w-3.5 h-3.5 mr-1 text-slate-400 dark:text-slate-500" />
        <span className="font-medium">Studio</span>
      </Link>

      {pathnames.map((value, index) => {
        const to = `/${pathnames.slice(0, index + 1).join('/')}`;
        const isLast = index === pathnames.length - 1;
        const prevSegment = index > 0 ? pathnames[index - 1] : undefined;
        const { label, icon, isProject } = resolveBreadcrumbLabel(value, prevSegment);

        return (
          <React.Fragment key={to}>
            <ChevronRight className="w-3 h-3 text-slate-400 dark:text-slate-600 shrink-0" />
            {isLast ? (
              <span className={`font-semibold truncate flex items-center shrink-0 ${isProject ? 'text-indigo-600 dark:text-indigo-300 font-mono' : 'text-slate-900 dark:text-slate-200'}`}>
                {icon}
                {label}
              </span>
            ) : (
              <Link to={to} className="text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors truncate flex items-center shrink-0">
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
