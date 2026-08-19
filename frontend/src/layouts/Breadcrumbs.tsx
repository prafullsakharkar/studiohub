import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

export const Breadcrumbs: React.FC = () => {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);

  const routeNameMap: Record<string, string> = {
    dashboard: 'Dashboard',
    projects: 'Productions',
    shots: 'Shots & Sequences',
    assets: 'Assets Hub',
    tasks: 'Tasks & Workflow',
    reviews: 'Screening Room',
    audit: 'Audit Logs',
    settings: 'Pipeline Settings',
  };

  return (
    <nav className="flex items-center space-x-2 text-xs text-slate-400 py-3 px-4 lg:px-8 border-b border-slate-800/60 bg-slate-950/20 select-none">
      <Link
        to="/dashboard"
        className="flex items-center hover:text-indigo-400 transition-colors"
      >
        <Home className="w-3.5 h-3.5 mr-1" />
        <span>Studio</span>
      </Link>

      {pathnames.map((value, index) => {
        const to = `/${pathnames.slice(0, index + 1).join('/')}`;
        const isLast = index === pathnames.length - 1;
        const name = routeNameMap[value] || value;

        return (
          <React.Fragment key={to}>
            <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
            {isLast ? (
              <span className="font-semibold text-slate-200 truncate">{name}</span>
            ) : (
              <Link to={to} className="hover:text-indigo-400 transition-colors truncate">
                {name}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
