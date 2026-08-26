import React from 'react';
import { PublishItem } from '@/types/publishing';
import { Card } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  RotateCcw,
  RefreshCw,
  Eye,
  History,
  Archive,
  HardDrive,
  User,
  Film,
  Box,
  Layers,
} from 'lucide-react';

interface PublishCardProps {
  item: PublishItem;
  onInspect: (item: PublishItem) => void;
  onRepublish: (item: PublishItem) => void;
  onValidate: (id: string) => void;
  onRetry: (id: string) => void;
  onUnpublish: (item: PublishItem) => void;
  onViewHistory: (item: PublishItem) => void;
}

export const PublishCard: React.FC<PublishCardProps> = ({
  item,
  onInspect,
  onRepublish,
  onValidate,
  onRetry,
  onUnpublish,
  onViewHistory,
}) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Published':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Published
          </span>
        );
      case 'Republished':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Republished
          </span>
        );
      case 'Validating':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-1.5 animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Validating
          </span>
        );
      case 'Failed':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5" /> QC Failed
          </span>
        );
      case 'Unpublished':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1.5">
            <Archive className="w-3.5 h-3.5" /> Unpublished
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> {status}
          </span>
        );
    }
  };

  const getDccBadge = (dcc: string) => {
    const colors: Record<string, string> = {
      Nuke: 'bg-amber-950/60 text-amber-300 border-amber-500/30',
      Maya: 'bg-cyan-950/60 text-cyan-300 border-cyan-500/30',
      Houdini: 'bg-orange-950/60 text-orange-300 border-orange-500/30',
      Blender: 'bg-blue-950/60 text-blue-300 border-blue-500/30',
      Unreal: 'bg-purple-950/60 text-purple-300 border-purple-500/30',
      USD: 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30',
    };
    return (
      <span
        className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${
          colors[dcc] || 'bg-slate-800 text-slate-300 border-slate-700'
        }`}
      >
        {dcc}
      </span>
    );
  };

  return (
    <Card
      id={`publish-card-${item.id}`}
      className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all duration-200 overflow-hidden flex flex-col justify-between group shadow-sm"
    >
      <div>
        {/* Header with thumbnail preview */}
        <div className="relative aspect-video w-full bg-slate-950 overflow-hidden border-b border-slate-800/80">
          <img
            src={item.thumbnail_url || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600'}
            alt={item.publish_code}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-85 group-hover:opacity-100"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-black/40 pointer-events-none" />

          {/* Top badges */}
          <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-auto">
            <div className="flex items-center gap-1.5">
              {getDccBadge(item.dcc_software)}
              <span className="px-2 py-0.5 rounded bg-black/70 text-slate-300 font-mono text-[10px] border border-slate-700/80">
                {item.version_number}
              </span>
            </div>
            <div>{getStatusBadge(item.status)}</div>
          </div>

          {/* Bottom frame specs */}
          <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-[11px] font-mono text-slate-300 pointer-events-auto">
            <span className="bg-black/80 px-2 py-0.5 rounded border border-slate-800 text-indigo-300">
              {item.entity_type === 'Shot' ? <Film className="w-3 h-3 inline mr-1" /> : <Box className="w-3 h-3 inline mr-1" />}
              {item.entity_code}
            </span>
            <span className="bg-black/80 px-2 py-0.5 rounded border border-slate-800 text-slate-400">
              {item.frame_range || `${item.file_count || 1} file(s)`} • {item.total_size_formatted || '2.0 GB'}
            </span>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-4 space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white text-sm truncate group-hover:text-indigo-400 transition-colors">
                {item.entity_name}
              </h3>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700/60">
                {item.project_code}
              </span>
            </div>
            <p className="text-xs font-mono text-slate-400 truncate mt-0.5">{item.publish_code}</p>
          </div>

          {/* Department and Artist */}
          <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/60">
            <span className="flex items-center gap-1 text-slate-300">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              {item.department}
            </span>
            <div className="flex items-center gap-1.5">
              {item.artist_avatar ? (
                <img src={item.artist_avatar} alt={item.artist_name} className="w-4 h-4 rounded-full object-cover" />
              ) : (
                <User className="w-3.5 h-3.5 text-slate-500" />
              )}
              <span className="text-[11px] text-slate-300">{item.artist_name}</span>
            </div>
          </div>

          {/* Destination */}
          <div className="p-2 bg-slate-950/80 rounded-lg border border-slate-800/80 text-[11px] flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-400 truncate mr-2">
              <HardDrive className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="truncate">{item.destination.name}</span>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 shrink-0">
              {item.destination.protocol}
            </span>
          </div>

          {/* Error banner if failed */}
          {item.status === 'Failed' && item.error_message && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span className="line-clamp-2 leading-relaxed">{item.error_message}</span>
            </div>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="p-3 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between gap-1.5">
        <Button
          id={`btn-inspect-pub-${item.id}`}
          variant="outline"
          size="sm"
          onClick={() => onInspect(item)}
          className="text-xs flex-1 text-slate-300 hover:text-white"
          leftIcon={<Eye className="w-3.5 h-3.5 text-indigo-400" />}
        >
          Inspect
        </Button>

        {item.status === 'Failed' ? (
          <Button
            id={`btn-retry-pub-${item.id}`}
            variant="primary"
            size="sm"
            onClick={() => onRetry(item.id)}
            className="text-xs bg-rose-600 hover:bg-rose-500 text-white"
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            Retry QC
          </Button>
        ) : (
          <Button
            id={`btn-republish-pub-${item.id}`}
            variant="outline"
            size="sm"
            onClick={() => onRepublish(item)}
            className="text-xs text-indigo-300 hover:text-indigo-200 border-indigo-500/30 hover:bg-indigo-500/10"
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Republish
          </Button>
        )}

        <Button
          id={`btn-hist-pub-${item.id}`}
          variant="outline"
          size="sm"
          onClick={() => onViewHistory(item)}
          className="text-xs text-slate-400 hover:text-slate-200 px-2.5"
          title="Publish Revisions & History"
        >
          <History className="w-3.5 h-3.5" />
        </Button>
      </div>
    </Card>
  );
};
