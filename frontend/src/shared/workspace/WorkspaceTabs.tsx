import type React from 'react';
import { useState } from 'react';
import { useWorkspaceStore } from '@/core/workspace/useWorkspaceStore';
import { getEntityIcon } from './EntityRef';
import {
  X,
  Plus,
  Pin,
  Columns,
  Copy,
  MoreHorizontal,
  Layers,
} from 'lucide-react';
import { cn } from '@/shared/utils/cn';

interface WorkspaceTabsProps {
  onNewTabClick?: () => void;
  className?: string;
}

export const WorkspaceTabs: React.FC<WorkspaceTabsProps> = ({
  onNewTabClick,
  className = '',
}) => {
  const {
    tabs,
    activeTabId,
    setActiveTabId,
    closeTab,
    togglePinTab,
    duplicateTab,
  } = useWorkspaceStore();

  const [contextMenuTabId, setContextMenuTabId] = useState<string | null>(null);

  const handleTabClick = (tabId: string) => {
    setActiveTabId(tabId);
  };

  const handleCloseClick = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    closeTab(tabId);
  };

  const handleAuxClick = (e: React.MouseEvent, tabId: string) => {
    // Middle click closes tab
    if (e.button === 1) {
      e.preventDefault();
      closeTab(tabId);
    }
  };

  return (
    <div
      className={cn(
        'flex items-center h-10 bg-slate-950 border-b border-slate-800/80 px-2 select-none overflow-hidden shrink-0',
        className
      )}
    >
      {/* Tabs List */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar flex-1 min-w-0 h-full py-1">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const Icon = getEntityIcon(tab.primary.type);
          const isPinned = tab.isPinned;
          const isSplit = tab.isSplit;

          return (
            <div
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              tabIndex={0}
              onClick={() => handleTabClick(tab.id)}
              onAuxClick={(e) => handleAuxClick(e, tab.id)}
              className={cn(
                'group relative flex items-center gap-2 h-8 px-3 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer shrink-0 border max-w-[200px]',
                isActive
                  ? 'bg-slate-900 text-slate-100 border-slate-700/80 shadow-sm'
                  : 'bg-slate-950/60 hover:bg-slate-900/60 text-slate-400 hover:text-slate-200 border-transparent hover:border-slate-800/60'
              )}
              title={`${tab.title || tab.primary.title || 'Tab'} (${tab.primary.type})`}
            >
              {/* Entity Type Icon */}
              <span
                className={cn(
                  'shrink-0',
                  isActive ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-400'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
              </span>

              {/* Tab Title */}
              <span className="truncate flex-1">
                {tab.title || tab.primary.code || tab.primary.title || 'Untitled'}
              </span>

              {/* Split View Indicator */}
              {isSplit && (
                <span title="Split View Active" className="shrink-0 text-slate-500">
                  <Columns className="w-3 h-3 text-cyan-400" />
                </span>
              )}

              {/* Pin Indicator / Action */}
              {isPinned ? (
                <span
                  title="Pinned Tab"
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePinTab(tab.id);
                  }}
                  className="shrink-0 text-amber-400/80 hover:text-amber-300"
                >
                  <Pin className="w-3 h-3 fill-amber-400/30" />
                </span>
              ) : null}

              {/* Close Button (shows on hover if not pinned, or always when active if tabs > 1) */}
              {!isPinned && (
                <button
                  type="button"
                  onClick={(e) => handleCloseClick(e, tab.id)}
                  title="Close Tab (Ctrl+W)"
                  className={cn(
                    'shrink-0 p-0.5 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-200 transition-colors',
                    isActive ? 'opacity-80 hover:opacity-100' : 'opacity-0 group-hover:opacity-100'
                  )}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}

        {/* New Tab Button */}
        {onNewTabClick && (
          <button
            type="button"
            onClick={onNewTabClick}
            title="Open Entity in New Tab (Cmd+K)"
            className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
