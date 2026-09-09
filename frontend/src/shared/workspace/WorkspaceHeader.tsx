import React, { useState } from 'react';
import { useWorkspaceStore } from '@/core/workspace/useWorkspaceStore';
import { formatEntityType, resolveEntity } from '@/core/workspace/entityRegistry';
import {
  Columns,
  Rows,
  Maximize2,
  PanelRight,
  Eye,
  ArrowLeftRight,
  X,
  Share2,
  Copy,
  Check,
  Sparkles,
  Layers,
  Search,
  ExternalLink,
} from 'lucide-react';
import { getEntityIcon, getEntityColorClass } from './EntityRef';
import { useNotificationStore } from '../stores/useNotificationStore';
import { cn } from '@/shared/utils/cn';

interface WorkspaceHeaderProps {
  onSearchClick?: () => void;
}

export const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({ onSearchClick }) => {
  const {
    tabs,
    activeTabId,
    setSplitMode,
    setSplitDirection,
    swapSplitEntities,
    closeSplit,
    openDrawer,
    openPeek,
  } = useWorkspaceStore();

  const [copied, setCopied] = useState(false);
  const addNotification = useNotificationStore((state) => state.addNotification);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  if (!activeTab) return null;

  const resolved = resolveEntity(activeTab.primary.type, activeTab.primary.id);
  const Icon = getEntityIcon(activeTab.primary.type);
  const colorClass = getEntityColorClass(activeTab.primary.type);

  const handleCopyDeepLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('primaryType', activeTab.primary.type);
    url.searchParams.set('primaryId', activeTab.primary.id);
    if (activeTab.isSplit && activeTab.secondary) {
      url.searchParams.set('view', 'split');
      url.searchParams.set('secondaryType', activeTab.secondary.type);
      url.searchParams.set('secondaryId', activeTab.secondary.id);
    } else {
      url.searchParams.delete('view');
      url.searchParams.delete('secondaryType');
      url.searchParams.delete('secondaryId');
    }

    navigator.clipboard?.writeText(url.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);

    addNotification({
      type: 'info',
      title: 'Deep Link Copied',
      message: `Universal workspace context URL copied: ${activeTab.primary.code || activeTab.primary.title}`,
    });
  };

  return (
    <div className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-2.5 flex items-center justify-between gap-4 font-sans select-none">
      {/* Primary Entity Header Snapshot */}
      <div className="flex items-center space-x-3 min-w-0">
        <div className={cn('p-2 rounded-xl border shrink-0', colorClass)}>
          <Icon className="w-5 h-5" />
        </div>

        <div className="min-w-0">
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-slate-400">
              {formatEntityType(activeTab.primary.type)}
            </span>
            <span className="font-mono text-xs font-bold text-indigo-300">
              {resolved?.code || activeTab.primary.code || activeTab.primary.id}
            </span>
            {resolved?.status && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-950 text-slate-300 border border-slate-800">
                {resolved.status}
              </span>
            )}
          </div>

          <h1 className="text-sm sm:text-base font-bold text-white truncate leading-tight mt-0.5">
            {resolved?.title || activeTab.primary.title}
          </h1>
        </div>
      </div>

      {/* Workspace Display Mode & Layout Toolstrip */}
      <div className="flex items-center space-x-1 sm:space-x-1.5 shrink-0">
        {/* Layout Modes: Split Horizontal / Split Vertical / Full */}
        <div className="flex items-center bg-slate-950 rounded-xl p-1 border border-slate-800 space-x-0.5">
          <button
            onClick={() => {
              if (activeTab.isSplit && activeTab.splitDirection === 'horizontal') {
                closeSplit(activeTab.id);
              } else {
                setSplitMode(
                  activeTab.id,
                  true,
                  activeTab.secondary || { id: 'cli-01', type: 'client', title: 'Warner Nexus Studios', code: 'WNEX' },
                  'horizontal'
                );
              }
            }}
            className={cn(
              'px-2 py-1 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-all',
              activeTab.isSplit && activeTab.splitDirection === 'horizontal'
                ? 'bg-indigo-600 text-white shadow-xs font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            )}
            title="Split Horizontal (Side-by-Side)"
          >
            <Columns className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Split H</span>
          </button>

          <button
            onClick={() => {
              if (activeTab.isSplit && activeTab.splitDirection === 'vertical') {
                closeSplit(activeTab.id);
              } else {
                setSplitMode(
                  activeTab.id,
                  true,
                  activeTab.secondary || { id: 'shot-001', type: 'shot', title: 'NK_010_010', code: 'NK_010_010' },
                  'vertical'
                );
              }
            }}
            className={cn(
              'px-2 py-1 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-all',
              activeTab.isSplit && activeTab.splitDirection === 'vertical'
                ? 'bg-indigo-600 text-white shadow-xs font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            )}
            title="Split Vertical (Stacked)"
          >
            <Rows className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Split V</span>
          </button>

          {activeTab.isSplit && (
            <button
              onClick={() => swapSplitEntities(activeTab.id)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900"
              title="Swap Left & Right Panels"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Quick Peek & Drawer Triggers */}
        <button
          onClick={() => openPeek(activeTab.primary)}
          className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-cyan-300 transition-colors"
          title="Quick Peek Card (Space)"
        >
          <Eye className="w-4 h-4" />
        </button>

        <button
          onClick={() => openDrawer(activeTab.primary)}
          className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-purple-300 transition-colors"
          title="Open Inspector Drawer"
        >
          <PanelRight className="w-4 h-4" />
        </button>

        {/* Deep Link Share */}
        <button
          onClick={handleCopyDeepLink}
          className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-emerald-300 transition-colors"
          title="Copy Context Deep Link"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};
