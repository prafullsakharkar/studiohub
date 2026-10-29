import type React from 'react';
import { cn } from '@/shared/utils/cn';

export interface WorkspaceShellProps {
  header?: React.ReactNode;
  tabs?: React.ReactNode;
  activeTabKey?: string;
  sidebar?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const WorkspaceShell: React.FC<WorkspaceShellProps> = ({
  header,
  tabs,
  activeTabKey,
  sidebar,
  children,
  className = '',
}) => {
  return (
    <div className={cn('min-h-screen bg-slate-950 text-slate-100 flex flex-col', className)}>
      {/* 1. Header Section */}
      {header && <header className="shrink-0 z-20">{header}</header>}

      {/* 2. Sub-Header Navigation / Tabs Section */}
      {tabs && (
        <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-md border-b border-slate-800/80 px-6 py-2">
          {tabs}
        </div>
      )}

      {/* 3. Main Workspace Body & Sidebar */}
      <div className="flex-1 flex min-h-0 relative">
        <main className="flex-1 min-w-0 px-6 py-6 overflow-y-auto">
          {children}
        </main>

        {sidebar && (
          <aside className="w-80 border-l border-slate-800 bg-slate-900/60 overflow-y-auto shrink-0 hidden lg:block">
            {sidebar}
          </aside>
        )}
      </div>
    </div>
  );
};
