import React, { useState } from 'react';
import { useWorkspaceStore } from '@/core/workspace/useWorkspaceStore';
import {
  Plus,
  X,
  Pin,
  PinOff,
  Copy,
  Columns,
  MoreVertical,
  Layers,
  Sparkles,
} from 'lucide-react';
import { getEntityIcon, getEntityColorClass } from './EntityRef';
import { cn } from '@/shared/utils/cn';

interface WorkspaceTabsProps {
  onNewTabClick?: () => void;
}

export const WorkspaceTabs: React.FC<WorkspaceTabsProps> = ({ onNewTabClick }) => {
  const {
    tabs,
    activeTabId,
    setActiveTabId,
    closeTab,
    duplicateTab,
    togglePinTab,
    setSplitMode,
    openTab,
  } = useWorkspaceStore();

  const [menuTabId, setMenuTabId] = useState<string | null>(null);

  const handleCreateDefaultTab = () => {
    if (onNewTabClick) {
      onNewTabClick();
    } else {
      openTab({
        id: 'proj-001',
        type: 'project',
        title: 'Cyberpunk 2099',
        code: 'NK99',
      });
    }
  };

  return (
    <div className="flex items-center bg-slate-950 border-b border-slate-800 px-2 pt-1.5 overflow-x-auto custom-scrollbar select-none">
      <div className="flex items-center space-x-1 flex-1 min-w-0">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const Icon = getEntityIcon(tab.primary.type);
          const colorClass = getEntityColorClass(tab.primary.type);

          return (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={cn(
                'group relative flex items-center space-x-2 px-3 py-1.5 rounded-t-lg border-t border-x text-xs font-mono transition-all cursor-pointer min-w-[130px] max-w-[220px]',
                isActive
                  ? 'bg-slate-900 border-slate-700 text-white shadow-xs z-10'
                  : 'bg-slate-950/60 border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
              )}
            >
              {/* Active Tab Highlight Indicator */}
              {isActive && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-t" />
              )}

              {/* Entity Icon */}
              <div className={cn('p-1 rounded shrink-0', colorClass)}>
                <Icon className="w-3 h-3" />
              </div>

              {/* Tab Title */}
              <span className="truncate flex-1 font-semibold text-[11px]">
                {tab.title}
              </span>

              {/* Split Indicator Badge */}
              {tab.isSplit && (
                <span className="px-1 py-0.2 rounded bg-indigo-500/20 text-indigo-300 text-[9px] font-bold border border-indigo-500/30 shrink-0">
                  SPLIT
                </span>
              )}

              {/* Pinned Icon */}
              {tab.isPinned && (
                <Pin className="w-3 h-3 text-amber-400 shrink-0 rotate-45" />
              )}

              {/* Context Actions / Close Button */}
              <div className="flex items-center space-x-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePinTab(tab.id);
                  }}
                  className="p-0.5 rounded text-slate-400 hover:text-white hover:bg-slate-800"
                  title={tab.isPinned ? 'Unpin Tab' : 'Pin Tab'}
                >
                  {tab.isPinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                </button>

                {!tab.isPinned && tabs.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.id);
                    }}
                    className="p-0.5 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800"
                    title="Close Tab"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Add Tab Button */}
        <button
          onClick={handleCreateDefaultTab}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors shrink-0"
          title="Open New Tab (Ctrl + T)"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
