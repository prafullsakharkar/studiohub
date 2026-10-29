import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/modules/auth';
import { cn } from '@/shared/utils/cn';
import { BackgroundJobsPage } from './BackgroundJobsPage';
import { TracksPage } from './TracksPage';

const TABS = [
  { id: 'background-jobs', label: 'Background Jobs', permission: 'background_jobs.view' },
  { id: 'tracks', label: 'Tracks', permission: 'tracks.view' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export const JobsWorkspacePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { can } = useAuth();
  const visible = TABS.filter((t) => can(t.permission));
  const requested = searchParams.get('tab') as TabId | null;
  const active: TabId = visible.some((t) => t.id === requested) ? (requested as TabId) : (visible[0]?.id ?? 'background-jobs');

  const setTab = (tab: TabId) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center gap-1.5 px-4 sm:px-6 pt-4" role="tablist" aria-label="Jobs and tracks">
        {visible.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active === tab.id}
            onClick={() => setTab(tab.id)}
            className={cn(
              'px-3.5 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap text-xs',
              active === tab.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0">
        {active === 'tracks' ? <TracksPage /> : <BackgroundJobsPage />}
      </div>
    </div>
  );
};
