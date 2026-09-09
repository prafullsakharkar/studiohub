import React, { useState } from 'react';
import {
  EntityReference,
  UniversalEntityType,
  UniversalEntityDetail,
} from '@/types/workspace';
import {
  resolveEntity,
  formatEntityType,
  searchUniversalEntities,
} from '@/core/workspace/entityRegistry';
import { useWorkspaceStore } from '@/core/workspace/useWorkspaceStore';
import {
  Eye,
  Columns,
  PanelRight,
  Maximize2,
  Layers,
  FileCode,
  History,
  MessageSquare,
  Activity,
  CheckCircle2,
  Clock,
  User,
  Film,
  Box,
  Clapperboard,
  CheckSquare,
  PlaySquare,
  Copy,
  Check,
  Download,
  Plus,
  Search,
  ExternalLink,
  ChevronRight,
  Terminal,
} from 'lucide-react';
import { EntityRef, getEntityIcon, getEntityColorClass } from './EntityRef';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { useNotificationStore } from '../stores/useNotificationStore';
import { cn } from '@/shared/utils/cn';

interface WorkspacePanelProps {
  entityRef: EntityReference;
  isSecondary?: boolean;
  onCloseSecondary?: () => void;
  onReplaceEntity?: (entity: EntityReference) => void;
}

export const WorkspacePanel: React.FC<WorkspacePanelProps> = ({
  entityRef,
  isSecondary = false,
  onCloseSecondary,
  onReplaceEntity,
}) => {
  const [activeSection, setActiveSection] = useState<'overview' | 'relations' | 'tasks' | 'versions' | 'directives' | 'activity'>('overview');
  const [copied, setCopied] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [notes, setNotes] = useState<Array<{ id: string; author: string; role: string; text: string; time: string }>>([
    {
      id: 'n1',
      author: 'Alex Chen',
      role: 'VFX Supervisor',
      text: 'Ensure all motion vectors match the latest 35mm anamorphic camera track.',
      time: '2 hours ago',
    },
  ]);

  const { openInWorkspace, openPeek, openDrawer } = useWorkspaceStore();
  const addNotification = useNotificationStore((state) => state.addNotification);

  const resolved = resolveEntity(entityRef.type, entityRef.id);
  if (!resolved) {
    return (
      <div className="p-8 text-center text-slate-400 font-mono text-xs flex flex-col items-center justify-center h-full">
        <Layers className="w-8 h-8 text-slate-600 mb-2 animate-pulse" />
        <p>Entity {entityRef.type}:{entityRef.id} not found in current studio context.</p>
      </div>
    );
  }

  const Icon = getEntityIcon(resolved.type);
  const colorClass = getEntityColorClass(resolved.type);

  const handleCopyUSD = (path: string) => {
    navigator.clipboard?.writeText(path);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    addNotification({
      type: 'info',
      title: 'OpenUSD Path Copied',
      message: `Copied stage prim identifier: ${path}`,
    });
  };

  const handleAddDirective = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    setNotes([
      {
        id: `note-${Date.now()}`,
        author: 'Current Supervisor',
        role: 'Lead Artist',
        text: newNote.trim(),
        time: 'Just now',
      },
      ...notes,
    ]);
    setNewNote('');
    addNotification({
      type: 'success',
      title: 'Directive Appended',
      message: 'Supervisor feedback posted to production record.',
    });
  };

  const sections = [
    { id: 'overview', label: 'Overview & Specs', icon: Layers },
    { id: 'relations', label: 'Transversal Links', icon: Activity, count: Object.values(resolved.relations).flat().filter(Boolean).length },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare, count: resolved.relations.tasks?.length },
    { id: 'versions', label: 'Published Versions', icon: FileCode, count: resolved.relations.versions?.length },
    { id: 'directives', label: 'Directives', icon: MessageSquare, count: notes.length },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-900 overflow-hidden font-sans border-r border-slate-800/80 last:border-r-0">
      {/* Panel Top Hero Bar */}
      <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-start justify-between gap-3 shrink-0">
        <div className="flex items-start space-x-3 min-w-0">
          <div className={cn('p-2.5 rounded-xl border shrink-0', colorClass)}>
            <Icon className="w-5 h-5" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center space-x-2 flex-wrap">
              <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-slate-400">
                {formatEntityType(resolved.type)}
              </span>
              <span className="font-mono text-xs font-bold text-indigo-300">
                {resolved.code}
              </span>
              {resolved.status && <StatusBadge status={resolved.status as any} />}
              {isSecondary && (
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  SECONDARY SPLIT
                </span>
              )}
            </div>

            <h2 className="text-base font-bold text-white truncate mt-0.5">
              {resolved.title}
            </h2>
            {resolved.subtitle && (
              <p className="text-xs text-slate-400 font-mono mt-0.5 truncate">
                {resolved.subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Panel Local Quick Actions */}
        <div className="flex items-center space-x-1 shrink-0">
          <button
            onClick={() => openPeek({ id: resolved.id, type: resolved.type, code: resolved.code, title: resolved.title })}
            className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-900 border border-slate-800"
            title="Peek Card"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => openDrawer({ id: resolved.id, type: resolved.type, code: resolved.code, title: resolved.title })}
            className="p-1.5 rounded-lg text-slate-400 hover:text-purple-300 hover:bg-slate-900 border border-slate-800"
            title="Open in Inspector Drawer"
          >
            <PanelRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => openInWorkspace({ id: resolved.id, type: resolved.type, code: resolved.code, title: resolved.title }, 'full')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 border border-slate-800"
            title="Focus Full View"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          {isSecondary && onCloseSecondary && (
            <button
              onClick={onCloseSecondary}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-900 border border-slate-800"
              title="Close Secondary Split"
            >
              <ExternalLink className="w-3.5 h-3.5 rotate-45" />
            </button>
          )}
        </div>
      </div>

      {/* Panel Sub-Navigation Section Bar */}
      <div className="flex border-b border-slate-800 bg-slate-950/60 px-3 overflow-x-auto custom-scrollbar select-none shrink-0">
        {sections.map((sec) => {
          const SecIcon = sec.icon;
          const isActive = activeSection === sec.id;

          return (
            <button
              key={sec.id}
              onClick={() => setActiveSection(sec.id as any)}
              className={cn(
                'py-2 px-3 flex items-center space-x-1.5 text-xs font-mono font-medium border-b-2 transition-all shrink-0',
                isActive
                  ? 'border-indigo-500 text-indigo-300 bg-indigo-950/20'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              )}
            >
              <SecIcon className="w-3.5 h-3.5" />
              <span>{sec.label}</span>
              {sec.count !== undefined && sec.count > 0 && (
                <span className="px-1 py-0.2 rounded-full text-[9px] bg-slate-800 text-slate-300">
                  {sec.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Panel Content Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar text-xs">
        {/* OVERVIEW SECTION */}
        {activeSection === 'overview' && (
          <div className="space-y-4">
            {/* Visual Thumbnail / Banner if Available */}
            {resolved.thumbnail_url && (
              <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-black aspect-video group">
                <img
                  src={resolved.thumbnail_url}
                  alt={resolved.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
                <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between font-mono text-[11px] text-slate-200">
                  <span className="font-bold">{resolved.code}</span>
                  <span className="text-emerald-400">ACES 1.3 / OpenUSD 24.08</span>
                </div>
              </div>
            )}

            {/* Description */}
            {resolved.description && (
              <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 space-y-1">
                <span className="text-[10px] font-mono text-slate-500 uppercase font-semibold block">
                  Production Synopsis & Scope
                </span>
                <p className="text-slate-300 text-xs leading-relaxed">
                  {resolved.description}
                </p>
              </div>
            )}

            {/* Core Properties Matrix */}
            <div className="space-y-2">
              <h3 className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                Pipeline Specifications
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(resolved.properties).map(([key, val]) => (
                  <div
                    key={key}
                    className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 flex flex-col justify-between"
                  >
                    <span className="text-[10px] font-mono text-slate-500 truncate">{key}</span>
                    <span className="font-mono text-slate-200 font-semibold text-xs mt-0.5 break-words">
                      {String(val)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* OpenUSD Prim Stage Path */}
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold flex items-center gap-1.5">
                  <Terminal className="w-3 h-3 text-indigo-400" />
                  <span>OpenUSD Composition Layer</span>
                </span>
                <button
                  onClick={() => handleCopyUSD(`@studio/shows/NK99/${resolved.type}s/${resolved.code}.usd`)}
                  className="text-[10px] font-mono text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>Copy Prim</span>
                </button>
              </div>
              <div className="p-2 bg-slate-900 rounded font-mono text-[11px] text-indigo-300 break-all border border-slate-800">
                {`@studio/shows/NK99/${resolved.type}s/${resolved.code}.usd`}
              </div>
            </div>
          </div>
        )}

        {/* TRANSVERSAL RELATIONS / NON-LINEAR EXPLORER */}
        {activeSection === 'relations' && (
          <div className="space-y-4">
            <div className="p-3 bg-indigo-950/20 rounded-xl border border-indigo-500/30 text-xs text-indigo-200">
              Explore related production nodes non-linearly. Hover for quick snapshot or click to navigate in Full, Split, or Drawer mode without losing context.
            </div>

            {/* Direct Hierarchical Links */}
            <div className="space-y-2">
              <h4 className="text-[11px] font-mono font-bold uppercase text-slate-400">
                Primary Associations
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {resolved.relations.parent && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono text-slate-500">Parent Entity:</span>
                    <EntityRef {...resolved.relations.parent} variant="card" />
                  </div>
                )}
                {resolved.relations.client && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono text-slate-500">Client Studio:</span>
                    <EntityRef {...resolved.relations.client} variant="card" />
                  </div>
                )}
                {resolved.relations.project && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono text-slate-500">Project Show:</span>
                    <EntityRef {...resolved.relations.project} variant="card" />
                  </div>
                )}
                {resolved.relations.vendor && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono text-slate-500">Vendor Partner:</span>
                    <EntityRef {...resolved.relations.vendor} variant="card" />
                  </div>
                )}
                {resolved.relations.assignee && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono text-slate-500">Lead Assignee:</span>
                    <EntityRef {...resolved.relations.assignee} variant="card" />
                  </div>
                )}
                {resolved.relations.reviewer && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono text-slate-500">Supervisor:</span>
                    <EntityRef {...resolved.relations.reviewer} variant="card" />
                  </div>
                )}
              </div>
            </div>

            {/* Related Shots */}
            {resolved.relations.shots && resolved.relations.shots.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-mono font-bold uppercase text-slate-400">
                    Associated Shots ({resolved.relations.shots.length})
                  </h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {resolved.relations.shots.map((shot) => (
                    <EntityRef key={shot.id} {...shot} variant="card" />
                  ))}
                </div>
              </div>
            )}

            {/* Related Assets */}
            {resolved.relations.assets && resolved.relations.assets.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-[11px] font-mono font-bold uppercase text-slate-400">
                  Associated Hero Assets ({resolved.relations.assets.length})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {resolved.relations.assets.map((ast) => (
                    <EntityRef key={ast.id} {...ast} variant="card" />
                  ))}
                </div>
              </div>
            )}

            {/* Related Deliveries */}
            {resolved.relations.deliveries && resolved.relations.deliveries.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-[11px] font-mono font-bold uppercase text-slate-400">
                  Turnover Packages ({resolved.relations.deliveries.length})
                </h4>
                <div className="grid grid-cols-1 gap-2">
                  {resolved.relations.deliveries.map((del) => (
                    <EntityRef key={del.id} {...del} variant="card" />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TASKS SECTION */}
        {activeSection === 'tasks' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                Work Orders & Sub-Tasks
              </h3>
              <button
                onClick={() => {
                  addNotification({
                    type: 'info',
                    title: 'Task Modal Ready',
                    message: `Opening task dispatch for ${resolved.code}`,
                  });
                }}
                className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-[11px] flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>Add Task</span>
              </button>
            </div>

            {resolved.relations.tasks && resolved.relations.tasks.length > 0 ? (
              <div className="space-y-2">
                {resolved.relations.tasks.map((task) => (
                  <EntityRef key={task.id} {...task} variant="card" />
                ))}
              </div>
            ) : (
              <div className="p-8 text-center bg-slate-950 rounded-xl border border-slate-800 text-slate-500 font-mono">
                No active sub-tasks assigned to this entity.
              </div>
            )}
          </div>
        )}

        {/* VERSIONS SECTION */}
        {activeSection === 'versions' && (
          <div className="space-y-3">
            <h3 className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">
              Published Cuts & Render Passes
            </h3>

            {resolved.relations.versions && resolved.relations.versions.length > 0 ? (
              <div className="space-y-2">
                {resolved.relations.versions.map((ver) => (
                  <EntityRef key={ver.id} {...ver} variant="card" />
                ))}
              </div>
            ) : (
              <div className="p-8 text-center bg-slate-950 rounded-xl border border-slate-800 text-slate-500 font-mono">
                No published cuts on record.
              </div>
            )}
          </div>
        )}

        {/* DIRECTIVES & NOTES SECTION */}
        {activeSection === 'directives' && (
          <div className="space-y-3">
            <h3 className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">
              Live Supervisor Directives
            </h3>

            <form onSubmit={handleAddDirective} className="space-y-2">
              <textarea
                rows={2}
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Post instruction or supervisor note..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-hidden"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!newNote.trim()}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold"
                >
                  Post Directive
                </button>
              </div>
            </form>

            <div className="space-y-2 pt-2 border-t border-slate-800">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1"
                >
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="font-bold text-indigo-300">
                      {note.author} <span className="text-slate-500 font-normal">({note.role})</span>
                    </span>
                    <span className="text-slate-500">{note.time}</span>
                  </div>
                  <p className="text-slate-200 text-xs leading-relaxed">{note.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
