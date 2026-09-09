import React, { useState } from 'react';
import { useWorkspaceStore } from '@/core/workspace/useWorkspaceStore';
import { formatEntityType, resolveEntity } from '@/core/workspace/entityRegistry';
import {
  ChevronRight,
  ChevronLeft,
  History,
  Layers,
  Sparkles,
  Search,
  ExternalLink,
  Split,
  Eye,
  PanelRight,
} from 'lucide-react';
import { EntityRef, getEntityIcon, getEntityColorClass } from './EntityRef';
import { cn } from '@/shared/utils/cn';

interface ContextBarProps {
  onOpenSearch?: () => void;
  onOpenContextStack?: () => void;
}

export const ContextBar: React.FC<ContextBarProps> = ({ onOpenSearch, onOpenContextStack }) => {
  const {
    tabs,
    activeTabId,
    navigateTabHistory,
    openInWorkspace,
    openPeek,
    openDrawer,
    contextStack,
  } = useWorkspaceStore();

  const [activeDropdownIndex, setActiveDropdownIndex] = useState<number | null>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  if (!activeTab) return null;

  const canGoBack = activeTab.historyIndex > 0;
  const canGoForward = activeTab.historyIndex < activeTab.history.length - 1;

  // Build relational breadcrumb context hierarchy for primary entity
  const resolvedPrimary = resolveEntity(activeTab.primary.type, activeTab.primary.id);
  
  // Breadcrumb chain: e.g. Client -> Project -> Sequence -> Shot
  const breadcrumbChain: Array<{
    type: any;
    id: string;
    code: string;
    title: string;
    isCurrent?: boolean;
  }> = [];

  if (resolvedPrimary) {
    if (resolvedPrimary.relations.client) {
      breadcrumbChain.push({
        type: 'client',
        id: resolvedPrimary.relations.client.id,
        code: resolvedPrimary.relations.client.code || 'CLIENT',
        title: resolvedPrimary.relations.client.title || 'Client Studio',
      });
    }
    if (resolvedPrimary.relations.project && activeTab.primary.type !== 'project') {
      breadcrumbChain.push({
        type: 'project',
        id: resolvedPrimary.relations.project.id,
        code: resolvedPrimary.relations.project.code || 'PROJECT',
        title: resolvedPrimary.relations.project.title || 'Project Show',
      });
    }
    if (resolvedPrimary.relations.sequence && activeTab.primary.type !== 'sequence') {
      breadcrumbChain.push({
        type: 'sequence',
        id: resolvedPrimary.relations.sequence.id,
        code: resolvedPrimary.relations.sequence.code || 'SEQUENCE',
        title: resolvedPrimary.relations.sequence.title || 'Sequence',
      });
    }

    breadcrumbChain.push({
      type: activeTab.primary.type,
      id: activeTab.primary.id,
      code: resolvedPrimary.code,
      title: resolvedPrimary.title,
      isCurrent: true,
    });
  } else {
    breadcrumbChain.push({
      type: activeTab.primary.type,
      id: activeTab.primary.id,
      code: activeTab.primary.code || activeTab.primary.id,
      title: activeTab.primary.title || activeTab.primary.id,
      isCurrent: true,
    });
  }

  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-slate-950 border-b border-slate-800 text-xs font-mono select-none overflow-x-auto custom-scrollbar">
      {/* Left: History Navigation & Context Breadcrumb Trail */}
      <div className="flex items-center space-x-1.5 min-w-0">
        {/* History Back/Forward */}
        <div className="flex items-center space-x-0.5 bg-slate-900 rounded-lg p-0.5 border border-slate-800 shrink-0">
          <button
            onClick={() => navigateTabHistory(activeTab.id, 'back')}
            disabled={!canGoBack}
            className={cn(
              'p-1 rounded text-slate-400 hover:text-white transition-colors',
              !canGoBack && 'opacity-30 cursor-not-allowed hover:text-slate-400'
            )}
            title="Go Back in Tab History (Alt + ←)"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => navigateTabHistory(activeTab.id, 'forward')}
            disabled={!canGoForward}
            className={cn(
              'p-1 rounded text-slate-400 hover:text-white transition-colors',
              !canGoForward && 'opacity-30 cursor-not-allowed hover:text-slate-400'
            )}
            title="Go Forward in Tab History (Alt + →)"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="h-4 w-px bg-slate-800 shrink-0" />

        {/* Dynamic Context Breadcrumbs */}
        <div className="flex items-center space-x-1 min-w-0">
          {breadcrumbChain.map((crumb, idx) => {
            const Icon = getEntityIcon(crumb.type);
            const color = getEntityColorClass(crumb.type);
            const isLast = idx === breadcrumbChain.length - 1;

            return (
              <React.Fragment key={`${crumb.type}-${crumb.id}-${idx}`}>
                {idx > 0 && <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />}

                <div className="relative group/crumb flex items-center">
                  <button
                    onClick={() => {
                      if (!isLast) {
                        openInWorkspace({ id: crumb.id, type: crumb.type, code: crumb.code, title: crumb.title }, 'full');
                      }
                    }}
                    className={cn(
                      'flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] transition-all truncate',
                      isLast
                        ? cn('font-bold border-indigo-500/50 bg-indigo-950/30 text-white shadow-xs', color)
                        : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:text-white hover:border-slate-700'
                    )}
                    title={`${formatEntityType(crumb.type)}: ${crumb.title}`}
                  >
                    <Icon className="w-3 h-3 shrink-0" />
                    <span className="truncate max-w-[120px] font-bold">{crumb.code}</span>
                  </button>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* Split Context Indicator if Active */}
        {activeTab.isSplit && activeTab.secondary && (
          <>
            <div className="h-4 w-px bg-slate-800 shrink-0" />
            <div className="flex items-center space-x-1 shrink-0">
              <span className="text-[10px] text-slate-500 uppercase">Split View:</span>
              <EntityRef
                type={activeTab.secondary.type}
                id={activeTab.secondary.id}
                code={activeTab.secondary.code}
                title={activeTab.secondary.title}
                size="sm"
              />
            </div>
          </>
        )}
      </div>

      {/* Right: Quick Tools & Context Stack Trigger */}
      <div className="flex items-center space-x-1.5 shrink-0 pl-2">
        {onOpenSearch && (
          <button
            onClick={onOpenSearch}
            className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 flex items-center gap-1.5 text-[11px]"
            title="Global Quick Open (Ctrl + K)"
          >
            <Search className="w-3 h-3 text-indigo-400" />
            <span className="hidden sm:inline">Jump Entity</span>
            <kbd className="text-[9px] bg-slate-950 px-1 py-0.2 rounded border border-slate-800 text-slate-500">
              ⌘K
            </kbd>
          </button>
        )}

        {onOpenContextStack && (
          <button
            onClick={onOpenContextStack}
            className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white flex items-center gap-1.5 text-[11px]"
            title="Context History Stack"
          >
            <History className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden md:inline">Stack</span>
            <span className="px-1 py-0.2 bg-indigo-500/20 text-indigo-300 rounded text-[9px] font-bold">
              {contextStack.length}
            </span>
          </button>
        )}
      </div>
    </div>
  );
};
