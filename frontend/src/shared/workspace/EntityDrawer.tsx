import React, { useRef, useState } from 'react';
import { useWorkspaceStore } from '@/core/workspace/useWorkspaceStore';
import { resolveEntity, formatEntityType } from '@/core/workspace/entityRegistry';
import {
  X,
  Maximize2,
  Columns,
  Layers,
  FileCode,
  CheckSquare,
  MessageSquare,
  Activity,
  Terminal,
  ChevronRight,
  Sparkles,
  Copy,
  Check,
} from 'lucide-react';
import { EntityRef, getEntityIcon, getEntityColorClass } from './EntityRef';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { useNotificationStore } from '../stores/useNotificationStore';
import { cn } from '@/shared/utils/cn';

export const EntityDrawer: React.FC = () => {
  const {
    drawer,
    closeDrawer,
    setDrawerTab,
    setDrawerWidth,
    openInWorkspace,
  } = useWorkspaceStore();

  const [copied, setCopied] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const addNotification = useNotificationStore((state) => state.addNotification);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = window.innerWidth - moveEvent.clientX;
      setDrawerWidth(newWidth);
    };

    const onMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  if (!drawer.isOpen || !drawer.entity) return null;

  const resolved = resolveEntity(drawer.entity.type, drawer.entity.id);
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
      title: 'OpenUSD Layer Copied',
      message: path,
    });
  };

  const tabs = [
    { id: 'details', label: 'Inspector', icon: Layers },
    { id: 'usd', label: 'USD Prim', icon: Terminal },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare, count: resolved.relations.tasks?.length },
    { id: 'notes', label: 'Directives', icon: MessageSquare },
  ];

  return (
    <div
      style={{ width: `${drawer.width}px` }}
      className="fixed top-0 right-0 bottom-0 z-40 bg-slate-950 border-l border-slate-800 shadow-2xl flex flex-col font-sans animate-in slide-in-from-right duration-200"
    >
      {/* Left Resize Handle */}
      <div
        onMouseDown={startResize}
        className={cn(
          'absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-indigo-500/60 transition-colors z-50',
          isResizing && 'bg-indigo-500'
        )}
      />

      {/* Drawer Top Bar */}
      <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-start justify-between gap-3 shrink-0">
        <div className="flex items-start space-x-3 min-w-0">
          <div className={cn('p-2 rounded-xl border shrink-0', colorClass)}>
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
            <h3 className="text-sm font-bold text-white truncate mt-0.5">
              {resolved.title}
            </h3>
          </div>
        </div>

        {/* Top Controls */}
        <div className="flex items-center space-x-1 shrink-0">
          <button
            onClick={() => {
              closeDrawer();
              openInWorkspace({ id: resolved.id, type: resolved.type, code: resolved.code, title: resolved.title }, 'split');
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-slate-800"
            title="Open in Split View"
          >
            <Columns className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              closeDrawer();
              openInWorkspace({ id: resolved.id, type: resolved.type, code: resolved.code, title: resolved.title }, 'full');
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            title="Open Full Page View"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          <button
            onClick={closeDrawer}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800"
            title="Close Drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Drawer Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-900/60 px-3 overflow-x-auto custom-scrollbar select-none shrink-0">
        {tabs.map((t) => {
          const TabIcon = t.icon;
          const isActive = drawer.activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setDrawerTab(t.id)}
              className={cn(
                'py-2 px-3 flex items-center space-x-1.5 text-xs font-mono font-medium border-b-2 transition-all shrink-0',
                isActive
                  ? 'border-indigo-500 text-indigo-300 bg-indigo-950/20'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              )}
            >
              <TabIcon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
              {t.count !== undefined && t.count > 0 && (
                <span className="px-1 py-0.2 rounded-full text-[9px] bg-slate-800 text-slate-300">
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Drawer Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar text-xs">
        {drawer.activeTab === 'details' && (
          <div className="space-y-4">
            {resolved.description && (
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                <span className="text-[10px] font-mono text-slate-500 uppercase font-semibold block">
                  Synopsis
                </span>
                <p className="text-slate-300 text-xs leading-relaxed">{resolved.description}</p>
              </div>
            )}

            <div className="space-y-2">
              <h4 className="text-[11px] font-mono uppercase text-slate-400 font-bold">
                Entity Properties
              </h4>
              <div className="grid grid-cols-1 gap-2">
                {Object.entries(resolved.properties).map(([k, v]) => (
                  <div
                    key={k}
                    className="p-2 bg-slate-900 rounded-lg border border-slate-800 flex justify-between items-center font-mono"
                  >
                    <span className="text-slate-400 text-[11px]">{k}</span>
                    <span className="text-white font-semibold text-right text-[11px] truncate max-w-[180px]">
                      {String(v)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Direct Links */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <h4 className="text-[11px] font-mono uppercase text-slate-400 font-bold">
                Connected Nodes
              </h4>
              <div className="space-y-1.5">
                {resolved.relations.parent && (
                  <EntityRef {...resolved.relations.parent} variant="card" />
                )}
                {resolved.relations.project && (
                  <EntityRef {...resolved.relations.project} variant="card" />
                )}
                {resolved.relations.client && (
                  <EntityRef {...resolved.relations.client} variant="card" />
                )}
                {resolved.relations.assignee && (
                  <EntityRef {...resolved.relations.assignee} variant="card" />
                )}
              </div>
            </div>
          </div>
        )}

        {drawer.activeTab === 'usd' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-mono uppercase text-slate-400 font-bold">
                OpenUSD Hierarchy & Stage
              </h4>
              <button
                onClick={handleCopyUSD}
                className="text-[10px] font-mono text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>Copy USD Prim</span>
              </button>
            </div>

            <div className="p-3 bg-black rounded-xl border border-slate-800 font-mono text-[11px] text-emerald-400 space-y-1.5">
              <div># OpenUSD 24.08 Stage Descriptor</div>
              <div className="text-slate-500">def Xform "World" &#123;</div>
              <div className="pl-4 text-indigo-300">
                def Scope "{resolved.type}s" &#123;
              </div>
              <div className="pl-8 text-cyan-300">
                def "{resolved.code}" (
              </div>
              <div className="pl-12 text-slate-400">
                references = @studio/shows/NK99/{resolved.type}s/{resolved.code}.usd@
              </div>
              <div className="pl-8 text-cyan-300">&#41; &#123;</div>
              <div className="pl-12 text-yellow-400">
                custom string studio:status = "{resolved.status || 'Active'}"
              </div>
              <div className="pl-8 text-cyan-300">&#125;</div>
              <div className="pl-4 text-indigo-300">&#125;</div>
              <div className="text-slate-500">&#125;</div>
            </div>
          </div>
        )}

        {drawer.activeTab === 'tasks' && (
          <div className="space-y-3">
            <h4 className="text-[11px] font-mono uppercase text-slate-400 font-bold">
              Assigned Tasks ({resolved.relations.tasks?.length || 0})
            </h4>
            {resolved.relations.tasks && resolved.relations.tasks.length > 0 ? (
              <div className="space-y-2">
                {resolved.relations.tasks.map((task) => (
                  <EntityRef key={task.id} {...task} variant="card" />
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-slate-500 font-mono bg-slate-900 rounded-xl border border-slate-800">
                No active sub-tasks.
              </div>
            )}
          </div>
        )}

        {drawer.activeTab === 'notes' && (
          <div className="space-y-3">
            <h4 className="text-[11px] font-mono uppercase text-slate-400 font-bold">
              Directives & Feedback
            </h4>
            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span className="font-bold text-indigo-300">Alex Chen (Supervisor)</span>
                <span>Today</span>
              </div>
              <p className="text-slate-200 text-xs">
                Check camera parallax against foreground neon sign elements.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
