import React, { useEffect } from 'react';
import { useWorkspaceStore } from '@/core/workspace/useWorkspaceStore';
import { resolveEntity, formatEntityType } from '@/core/workspace/entityRegistry';
import {
  X,
  Maximize2,
  Columns,
  PanelRight,
  Copy,
  Check,
  Layers,
  Terminal,
  ExternalLink,
  Film,
  Box,
  Clapperboard,
  CheckSquare,
  Sparkles,
} from 'lucide-react';
import { EntityRef, getEntityIcon, getEntityColorClass } from './EntityRef';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { useNotificationStore } from '../stores/useNotificationStore';
import { cn } from '@/shared/utils/cn';

export const PeekPanel: React.FC = () => {
  const { peek, closePeek, openInWorkspace, openDrawer } = useWorkspaceStore();
  const [copied, setCopied] = React.useState(false);
  const addNotification = useNotificationStore((state) => state.addNotification);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && peek.isOpen) {
        closePeek();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [peek.isOpen, closePeek]);

  if (!peek.isOpen || !peek.entity) return null;

  const resolved = resolveEntity(peek.entity.type, peek.entity.id);
  if (!resolved) return null;

  const Icon = getEntityIcon(resolved.type);
  const colorClass = getEntityColorClass(resolved.type);

  const handleCopyUSD = () => {
    const path = `@studio/shows/NK99/${resolved.type}s/${resolved.code}.usd`;
    navigator.clipboard?.writeText(path);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    addNotification({
      type: 'info',
      title: 'OpenUSD Prim Copied',
      message: path,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150 select-none">
      {/* Click outside backdrop */}
      <div className="absolute inset-0" onClick={closePeek} />

      {/* Modal Card */}
      <div className="relative z-10 w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] font-sans">
        {/* Header Hero */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-start justify-between gap-3">
          <div className="flex items-start space-x-3 min-w-0">
            <div className={cn('p-2.5 rounded-xl border shrink-0', colorClass)}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-mono uppercase font-bold text-slate-400">
                  {formatEntityType(resolved.type)}
                </span>
                <span className="font-mono text-xs font-bold text-indigo-300">
                  {resolved.code}
                </span>
                {resolved.status && <StatusBadge status={resolved.status as any} />}
              </div>
              <h3 className="text-base font-bold text-white truncate mt-0.5">
                {resolved.title}
              </h3>
              {resolved.subtitle && (
                <p className="text-xs text-slate-400 font-mono">{resolved.subtitle}</p>
              )}
            </div>
          </div>

          <button
            onClick={closePeek}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            title="Close Peek (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Peek Body */}
        <div className="p-5 overflow-y-auto space-y-4 custom-scrollbar text-xs">
          {/* Thumbnail preview if available */}
          {resolved.thumbnail_url && (
            <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-black aspect-video">
              <img
                src={resolved.thumbnail_url}
                alt={resolved.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Description */}
          {resolved.description && (
            <p className="text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              {resolved.description}
            </p>
          )}

          {/* Key Specs Grid */}
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(resolved.properties)
              .slice(0, 6)
              .map(([k, v]) => (
                <div
                  key={k}
                  className="p-2.5 bg-slate-950 rounded-xl border border-slate-800/80 font-mono"
                >
                  <span className="text-[10px] text-slate-500 block">{k}</span>
                  <span className="text-slate-200 font-semibold truncate block mt-0.5">
                    {String(v)}
                  </span>
                </div>
              ))}
          </div>

          {/* Transversal Related Nodes Preview */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <h4 className="text-[11px] font-mono font-bold uppercase text-slate-400">
              Direct Relations
            </h4>
            <div className="flex flex-wrap gap-2">
              {resolved.relations.parent && (
                <EntityRef {...resolved.relations.parent} variant="badge" />
              )}
              {resolved.relations.client && (
                <EntityRef {...resolved.relations.client} variant="badge" />
              )}
              {resolved.relations.project && (
                <EntityRef {...resolved.relations.project} variant="badge" />
              )}
              {resolved.relations.assignee && (
                <EntityRef {...resolved.relations.assignee} variant="badge" />
              )}
              {resolved.relations.shots?.slice(0, 2).map((s) => (
                <EntityRef key={s.id} {...s} variant="badge" />
              ))}
            </div>
          </div>
        </div>

        {/* Footer Action Bar */}
        <div className="p-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-2">
          <button
            onClick={handleCopyUSD}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-mono flex items-center gap-1.5"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Copy Prim</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                closePeek();
                openInWorkspace({ id: resolved.id, type: resolved.type, code: resolved.code, title: resolved.title }, 'split');
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-semibold flex items-center gap-1.5"
            >
              <Columns className="w-3.5 h-3.5 text-indigo-400" />
              <span>Open in Split</span>
            </button>

            <button
              onClick={() => {
                closePeek();
                openDrawer({ id: resolved.id, type: resolved.type, code: resolved.code, title: resolved.title });
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-semibold flex items-center gap-1.5"
            >
              <PanelRight className="w-3.5 h-3.5 text-purple-400" />
              <span>Drawer</span>
            </button>

            <button
              onClick={() => {
                closePeek();
                openInWorkspace({ id: resolved.id, type: resolved.type, code: resolved.code, title: resolved.title }, 'full');
              }}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Full Page</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
