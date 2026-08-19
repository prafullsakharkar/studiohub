import React, { useState } from 'react';
import {
  X,
  Clapperboard,
  Box,
  CheckSquare,
  PlaySquare,
  Layers,
  FileCode,
  History,
  MessageSquare,
  ExternalLink,
  CheckCircle2,
  Clock,
  Cpu,
  User,
  Copy,
  Check,
  Download,
  Terminal,
  Film,
  Sparkles,
} from 'lucide-react';
import { useInspectorStore } from '../stores/useInspectorStore';
import { StatusBadge } from './StatusBadge';
import { Button } from './Button';
import { useNotificationStore } from '../stores/useNotificationStore';
import { Link } from 'react-router-dom';

export const InspectorDrawer: React.FC = () => {
  const { isOpen, entityType, entityData, activeTab, closeInspector, setActiveTab } = useInspectorStore();
  const [copied, setCopied] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [notesList, setNotesList] = useState<Array<{ id: string; author: string; text: string; time: string }>>([
    {
      id: '1',
      author: 'Alex Chen (Supervisor)',
      text: 'Ensure edge motion blur is sampled with at least 8 sub-steps for high velocity passes.',
      time: '2 hours ago',
    },
  ]);

  const addNotification = useNotificationStore((state) => state.addNotification);

  if (!isOpen || !entityData) return null;

  const handleCopyPath = (path: string) => {
    navigator.clipboard?.writeText(path);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    addNotification({
      type: 'info',
      title: 'Copied to Clipboard',
      message: `OpenUSD prim path copied: ${path}`,
    });
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    setNotesList([
      {
        id: Date.now().toString(),
        author: 'Current User',
        text: newNote.trim(),
        time: 'Just now',
      },
      ...notesList,
    ]);
    setNewNote('');
    addNotification({
      type: 'success',
      title: 'Note Added',
      message: 'Supervisor directive appended to entity record.',
    });
  };

  const getEntityIcon = () => {
    switch (entityType) {
      case 'shot':
        return <Clapperboard className="w-4 h-4 text-indigo-400" />;
      case 'asset':
        return <Box className="w-4 h-4 text-emerald-400" />;
      case 'task':
        return <CheckSquare className="w-4 h-4 text-amber-400" />;
      case 'review':
        return <PlaySquare className="w-4 h-4 text-violet-400" />;
      default:
        return <Layers className="w-4 h-4 text-slate-400" />;
    }
  };

  const entityCode = entityData.code || entityData.entity_code || entityData.title || 'RECORD';
  const entityTitle = entityData.name || entityData.title || entityData.code;
  const usdPath = `@studio/shows/${entityData.project_code || 'NK99'}/${entityType}s/${entityCode}.usd`;

  return (
    <aside
      id="right-inspector-drawer"
      className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 md:w-[420px] bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col transition-all duration-200 animate-in slide-in-from-right font-sans"
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/70 flex items-start justify-between gap-3">
        <div className="flex items-start space-x-3 min-w-0">
          <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 shrink-0 mt-0.5">
            {getEntityIcon()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-1.5">
              <span className="font-mono text-xs font-bold text-indigo-300 truncate">
                {entityCode}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {entityData.current_version || entityData.version || 'v001'}
              </span>
            </div>
            <h2 className="text-sm font-bold text-white truncate">{entityTitle}</h2>
          </div>
        </div>

        <button
          onClick={closeInspector}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
          title="Close Inspector"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Quick Action Strip */}
      <div className="px-4 py-2 bg-slate-950/40 border-b border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center space-x-1.5">
          <StatusBadge status={entityData.status || 'In Progress'} />
          {entityData.sequence_code && (
            <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
              {entityData.sequence_code}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => handleCopyPath(usdPath)}
            className="p-1 text-[11px] font-mono rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 flex items-center gap-1"
            title="Copy OpenUSD Stage Path"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span className="text-[10px]">USD</span>
          </button>

          <Link to="/reviews">
            <button
              className="p-1 text-[11px] rounded bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 flex items-center gap-1"
              title="Launch Screening Room"
            >
              <PlaySquare className="w-3 h-3" />
              <span className="text-[10px]">Dailies</span>
            </button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-950/90 px-3 text-xs font-mono">
        {[
          { id: 'details', label: 'Inspector', icon: Layers },
          { id: 'files', label: 'OpenUSD Tree', icon: FileCode },
          { id: 'history', label: 'Versions', icon: History },
          { id: 'notes', label: 'Directives', icon: MessageSquare },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 border-b-2 text-[11px] font-semibold transition-all ${
                isActive
                  ? 'border-indigo-500 text-indigo-300 bg-indigo-950/20'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar text-xs">
        {/* DETAILS TAB */}
        {activeTab === 'details' && (
          <div className="space-y-4">
            {/* Visual Preview */}
            {entityData.thumbnail_url && (
              <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-black aspect-video group">
                <img
                  src={entityData.thumbnail_url}
                  alt={entityTitle}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[10px] font-mono text-slate-300">
                  <span>Show: {entityData.project_code || 'NK99'}</span>
                  <span>ACEScg / Rec.709</span>
                </div>
              </div>
            )}

            {/* Core Metadata Grid */}
            <div className="space-y-2">
              <h3 className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
                Pipeline Specifications
              </h3>
              <div className="grid grid-cols-2 gap-2 bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                {entityData.frame_in !== undefined && (
                  <div>
                    <span className="text-[10px] text-slate-500 block">Frame Cut Range</span>
                    <span className="font-mono text-slate-200 font-bold">
                      {entityData.frame_in} - {entityData.frame_out} ({entityData.frame_count || entityData.frame_out - entityData.frame_in + 1}f)
                    </span>
                  </div>
                )}
                {entityData.handle_frames !== undefined && (
                  <div>
                    <span className="text-[10px] text-slate-500 block">Head/Tail Handles</span>
                    <span className="font-mono text-slate-200 font-bold">
                      ±{entityData.handle_frames} frames
                    </span>
                  </div>
                )}
                {entityData.poly_count !== undefined && (
                  <div>
                    <span className="text-[10px] text-slate-500 block">Polygon Budget</span>
                    <span className="font-mono text-indigo-300 font-bold">
                      {(entityData.poly_count / 1000000).toFixed(2)}M Triranges
                    </span>
                  </div>
                )}
                {entityData.lod_levels !== undefined && (
                  <div>
                    <span className="text-[10px] text-slate-500 block">LOD Cascades</span>
                    <span className="font-mono text-slate-200 font-bold">
                      {entityData.lod_levels} Levels of Detail
                    </span>
                  </div>
                )}
                {entityData.software && (
                  <div>
                    <span className="text-[10px] text-slate-500 block">Authoring DCC</span>
                    <span className="text-slate-200 font-medium">{entityData.software}</span>
                  </div>
                )}
                {entityData.department && (
                  <div>
                    <span className="text-[10px] text-slate-500 block">Discipline</span>
                    <span className="text-slate-200 font-medium">{entityData.department}</span>
                  </div>
                )}
                <div>
                  <span className="text-[10px] text-slate-500 block">Assignee</span>
                  <span className="text-slate-200 font-medium flex items-center gap-1 mt-0.5">
                    <User className="w-3 h-3 text-indigo-400" />
                    {entityData.assigned_artist_name || entityData.assignee_name || 'Alex Chen'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Color Transform</span>
                  <span className="font-mono text-emerald-400 text-[11px]">ACES - ACEScg</span>
                </div>
              </div>
            </div>

            {/* Discipline Pipeline Matrix if Shot */}
            {entityData.pipeline && (
              <div className="space-y-2">
                <h3 className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
                  Discipline Passes
                </h3>
                <div className="grid grid-cols-5 gap-1.5 font-mono text-[10px] text-center">
                  {Object.entries(entityData.pipeline).map(([stage, status]: [string, any]) => (
                    <div
                      key={stage}
                      className={`p-2 rounded-lg border flex flex-col justify-center items-center ${
                        status === 'Approved'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                          : status === 'In Progress'
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                          : status === 'Pending Review'
                          ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
                          : 'bg-slate-950 border-slate-800 text-slate-500'
                      }`}
                    >
                      <span className="font-bold uppercase">{stage.slice(0, 4)}</span>
                      <span className="text-[9px] mt-0.5 opacity-80">{status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            {entityData.description && (
              <div className="space-y-1 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] font-mono text-slate-500 block uppercase">Notes & Directives</span>
                <p className="text-slate-300 text-xs leading-relaxed">{entityData.description}</p>
              </div>
            )}
          </div>
        )}

        {/* OPENUSD TREE TAB */}
        {activeTab === 'files' && (
          <div className="space-y-3">
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
              <span className="text-[10px] font-mono text-slate-500 block uppercase">Root Composition Stage</span>
              <div className="p-2 bg-slate-900 rounded font-mono text-[11px] text-indigo-300 break-all border border-slate-800">
                {usdPath}
              </div>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
                OpenUSD Prims & Sublayers
              </h3>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[11px] space-y-2">
                <div className="text-slate-300 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="font-bold">/Root</span> <span className="text-slate-500">(UsdStage)</span>
                </div>
                <div className="pl-4 space-y-1.5 border-l border-slate-800">
                  <div className="text-slate-300 flex items-center justify-between">
                    <span>├─ /World</span>
                    <span className="text-[9px] text-slate-500">Def Xform</span>
                  </div>
                  <div className="pl-4 space-y-1.5 border-l border-slate-800">
                    <div className="text-emerald-400 flex items-center justify-between">
                      <span>├─ /World/Geometry</span>
                      <span className="text-[9px] text-slate-500">Alembic Sublayer</span>
                    </div>
                    <div className="text-amber-400 flex items-center justify-between">
                      <span>├─ /World/Materials</span>
                      <span className="text-[9px] text-slate-500">MaterialX Shaders</span>
                    </div>
                    <div className="text-sky-400 flex items-center justify-between">
                      <span>└─ /World/Cameras/RenderCam</span>
                      <span className="text-[9px] text-slate-500">35mm Anamorphic</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full"
              leftIcon={<Download className="w-3.5 h-3.5" />}
              onClick={() => {
                addNotification({
                  type: 'info',
                  title: 'Asset Packaged',
                  message: `Exported ${entityCode}.usda bundle for local Houdini/Maya ingestion.`,
                });
              }}
            >
              Export USDA Manifest
            </Button>
          </div>
        )}

        {/* VERSIONS / HISTORY TAB */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            <h3 className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
              Revision Stack
            </h3>
            <div className="space-y-2">
              {[
                { version: 'v003', date: 'Today, 02:40 PM', author: 'Elena Rostova', status: 'Approved', note: 'Addressed edge flare intensity' },
                { version: 'v002', date: 'Yesterday, 06:15 PM', author: 'Alex Chen', status: 'Retake', note: 'Sparks decay rate was 15% too fast' },
                { version: 'v001', date: 'Aug 14, 2026', author: 'Sarah Jenkins', status: 'Archived', note: 'Initial geometry pass' },
              ].map((ver, idx) => (
                <div
                  key={ver.version}
                  className={`p-3 rounded-xl border transition-all ${
                    idx === 0
                      ? 'bg-indigo-950/30 border-indigo-500/40 shadow-xs'
                      : 'bg-slate-950/60 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-white flex items-center gap-1.5">
                      {ver.version}
                      {idx === 0 && <span className="text-[9px] px-1 py-0.2 bg-emerald-500/20 text-emerald-300 rounded font-semibold">Latest Cut</span>}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">{ver.date}</span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">{ver.note}</p>
                  <div className="text-[10px] text-slate-500 mt-1.5 flex justify-between">
                    <span>Artist: {ver.author}</span>
                    <span className="font-mono text-indigo-400">{ver.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DIRECTIVES & NOTES TAB */}
        {activeTab === 'notes' && (
          <div className="space-y-3">
            <h3 className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
              Supervisor Directives & Dailies Feedback
            </h3>

            {/* Note Submission Form */}
            <form onSubmit={handleAddNote} className="space-y-2">
              <textarea
                rows={2}
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add frame note or production instruction..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:ring-1 focus:ring-indigo-500"
              />
              <div className="flex justify-end">
                <Button variant="primary" size="sm" type="submit" disabled={!newNote.trim()}>
                  Post Directive
                </Button>
              </div>
            </form>

            <div className="space-y-2 pt-2 border-t border-slate-800">
              {notesList.map((note) => (
                <div key={note.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                  <div className="flex justify-between text-[10px] font-mono">
                    <strong className="text-indigo-300">{note.author}</strong>
                    <span className="text-slate-500">{note.time}</span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed">{note.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
