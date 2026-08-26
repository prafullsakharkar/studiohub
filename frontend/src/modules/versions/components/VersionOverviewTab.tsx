import React from 'react';
import {
  Film,
  Layers,
  Sparkles,
  Clock,
  Calendar,
  User,
  CheckCircle2,
  HardDrive,
  Cpu,
  FileCode,
  Tag,
  GitCommit,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { ProductionVersion } from '@/types/versions';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { MediaViewer } from '@/shared/components/media/MediaViewer';

interface VersionOverviewTabProps {
  version: ProductionVersion;
  onOpenMedia?: () => void;
  onOpenReview?: () => void;
  onPublishClick?: () => void;
  onCompareClick?: () => void;
}

export const VersionOverviewTab: React.FC<VersionOverviewTabProps> = ({
  version,
  onOpenMedia,
  onOpenReview,
  onPublishClick,
  onCompareClick,
}) => {
  return (
    <div className="space-y-6">
      {/* Viewport Preview Hero Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center">
              <Film className="w-3.5 h-3.5 mr-1.5 text-blue-400" />
              Primary Master Viewport
            </h3>
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="text-[10px] font-mono text-cyan-400 border-cyan-500/30">
                {version.color_space || 'ACEScg'}
              </Badge>
              <Badge variant="outline" className="text-[10px] font-mono text-purple-400 border-purple-500/30">
                {version.resolution || '4K DCI'}
              </Badge>
            </div>
          </div>

          <MediaViewer
            title={`${version.version_number} — ${version.code}`}
            sourceUrl={version.video_url}
            thumbnailUrl={version.thumbnail_url}
            mediaType={version.media_type}
            colorSpace={version.color_space}
            resolution={version.resolution}
            fps={version.fps}
            startFrame={version.start_frame}
            endFrame={version.end_frame}
            className="w-full"
          />
        </div>

        {/* Quick Inspector Details Card */}
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-mono font-bold text-slate-300 uppercase">Version Manifest</span>
              <StatusBadge status={version.status} />
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Version Number:</span>
                <span className="text-blue-400 font-bold">{version.version_number}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Project / Show:</span>
                <span className="text-slate-200 font-semibold">{version.project_code} ({version.project_name})</span>
              </div>
              {version.shot_code && (
                <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Linked Shot:</span>
                  <span className="text-cyan-400 font-semibold">{version.shot_code}</span>
                </div>
              )}
              {version.asset_code && (
                <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Linked Asset:</span>
                  <span className="text-amber-400 font-semibold">{version.asset_code}</span>
                </div>
              )}
              <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Task Stage:</span>
                <span className="text-slate-200">{version.task_name || version.task_title || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Department:</span>
                <span className="text-slate-200">{version.department}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Author / Artist:</span>
                <div className="flex items-center space-x-1.5 text-slate-200">
                  <img
                    src={version.artist?.avatar || version.artist_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                    alt={version.artist?.name || version.artist_name || 'Artist'}
                    className="w-4 h-4 rounded-full"
                  />
                  <span>{version.artist?.name || version.artist_name || 'Artist'}</span>
                </div>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-400">Publish State:</span>
                <Badge variant={version.is_published ? 'success' : 'outline'} className="text-[10px]">
                  {version.is_published ? 'Published to OpenUSD' : 'WIP / Unpublished'}
                </Badge>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-center font-mono text-xs"
                onClick={onCompareClick}
              >
                Compare with Previous Version
              </Button>
              {onOpenReview && (
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full justify-center font-mono text-xs"
                  onClick={onOpenReview}
                >
                  Open in Review Session
                </Button>
              )}
            </div>
          </div>

          {/* Description Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
            <span className="text-xs font-mono font-bold text-slate-300 uppercase">Artist Notes</span>
            <p className="text-xs text-slate-400 leading-relaxed">
              {version.description || 'No artist revision notes provided for this render submission.'}
            </p>
          </div>
        </div>
      </div>

      {/* Production Specifications Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="flex items-center space-x-2 text-slate-400 text-xs font-mono">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            <span>Frame Range</span>
          </div>
          <span className="text-lg font-mono font-bold text-white block">
            {version.start_frame} - {version.end_frame}
          </span>
          <span className="text-[11px] font-mono text-slate-500">
            {version.frame_count} frames ({version.duration_seconds}s @ {version.fps}fps)
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="flex items-center space-x-2 text-slate-400 text-xs font-mono">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>DCC Integration</span>
          </div>
          <span className="text-lg font-mono font-bold text-white block truncate">
            {version.dcc_software || 'OpenUSD Core'}
          </span>
          <span className="text-[11px] font-mono text-slate-500">
            {version.color_space} Pipeline
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="flex items-center space-x-2 text-slate-400 text-xs font-mono">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>Reviews & Notes</span>
          </div>
          <span className="text-lg font-mono font-bold text-white block">
            {version.reviews_count} Sessions
          </span>
          <span className="text-[11px] font-mono text-slate-500">
            {version.notes_count} Director comments
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="flex items-center space-x-2 text-slate-400 text-xs font-mono">
            <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
            <span>File Size & Storage</span>
          </div>
          <span className="text-lg font-mono font-bold text-white block">
            {version.file_size_mb} MB
          </span>
          <span className="text-[11px] font-mono text-slate-500">
            NVMe Tier 1 Scratch
          </span>
        </div>
      </div>
    </div>
  );
};
