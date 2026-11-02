import { ArrowLeft } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { QueryBoundary } from '@/components/system/QueryBoundary';
import { Button } from '@/shared/components/Button';
import { ScrollableTabs } from '@/shared/components/tabs/ScrollableTabs';
import { TabContentTransition } from '@/shared/components/tabs/TabContentTransition';

export interface WorkspaceTab {
  id: string;
  label: string;
  render: () => React.ReactNode;
}

export interface WorkspaceShellProps {
  /** What the page is called in messages: "client", "team", … */
  noun: string;
  /** The directory the back link returns to, e.g. `/clients`. */
  backPath: string;
  backLabel: string;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  /** The loaded record; the header and tabs render only once it exists. */
  record: { title: string; code?: string; icon: React.ReactNode; badges?: React.ReactNode; subtitle?: React.ReactNode } | null;
  actions?: React.ReactNode;
  tabs: WorkspaceTab[];
}

/**
 * The frame of a record's workspace page: loading and error states (a 404 says the record is gone),
 * a header with the record's name, code and actions, and tabs whose content mounts only while open.
 */
export const WorkspaceShell: React.FC<WorkspaceShellProps> = ({ noun, backPath, backLabel, isLoading, error, onRetry, record, actions, tabs }) => {
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? '');
  const current = tabs.find((t) => t.id === activeTab) ?? tabs[0];

  return (
    <div className="p-4 sm:p-6 space-y-6 flex-1 min-h-0 w-full">
      <QueryBoundary isLoading={isLoading} error={error} onRetry={onRetry} entityName={noun}>
        {record && (
          <>
            <header className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400" aria-hidden="true">
                    {record.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-lg font-bold text-white break-words">{record.title}</h1>
                      {record.code && <span className="px-2 py-0.5 rounded bg-indigo-950 font-mono text-[10px] font-bold text-indigo-300 border border-indigo-500/30">{record.code}</span>}
                      {record.badges}
                    </div>
                    {record.subtitle && <p className="text-xs text-slate-400 mt-1">{record.subtitle}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Link to={backPath}>
                    <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
                      {backLabel}
                    </Button>
                  </Link>
                  {actions}
                </div>
              </div>
            </header>

            <ScrollableTabs tabs={tabs.map(({ id, label }) => ({ id, label }))} activeTab={current?.id ?? ''} onTabChange={setActiveTab} ariaLabel={`${noun} sections`} />
            <TabContentTransition tabKey={current?.id ?? ''}>{current?.render()}</TabContentTransition>
          </>
        )}
      </QueryBoundary>
    </div>
  );
};
