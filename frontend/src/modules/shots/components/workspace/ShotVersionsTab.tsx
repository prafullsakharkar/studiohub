import React from 'react';
import { SmartImg } from '@/components/ui/SmartImg';
import { Shot } from '@/types/production';
import { ProductionVersion } from '@/types/production';
import {
  GitBranch,
  Plus,
  Play,
  CheckCircle2,
  FileCode,
  HardDrive,
  ExternalLink,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Badge } from '@/shared/components/Badge';
import { Link } from 'react-router-dom';
import { PermissionButton } from '@/core/permissions/PermissionComponents';
import { WorkspaceOpenButton } from '@/shared/workspace/canonical/WorkspaceButtons';

export interface ShotVersionsTabProps {
  shot: Shot;
  versions: ProductionVersion[];
  onOpenSubmitVersion: () => void;
}

export const ShotVersionsTab: React.FC<ShotVersionsTabProps> = ({
  shot,
  versions,
  onOpenSubmitVersion,
}) => {
  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            Version Lineage ({versions.length})
          </span>
          <span className="text-xs text-slate-400 font-mono">
            Active: <span className="text-indigo-300 font-bold">{shot.current_version || 'v001'}</span>
          </span>
        </div>

        <PermissionButton
          variant="primary"
          size="sm"
          permission="version.create"
          onClick={onOpenSubmitVersion}
          leftIcon={<Plus className="w-3.5 h-3.5" />}
        >
          Submit Version
        </PermissionButton>
      </div>

      {versions.length === 0 ? (
        <Card className="border-slate-800 bg-slate-900/50 p-12 text-center">
          <GitBranch className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-white">No Versions Submitted Yet</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
            Submit an EXR sequence or playblast render to initialize the dailies review chain.
          </p>
          <Button
            size="sm"
            variant="outline"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={onOpenSubmitVersion}
            className="mx-auto"
          >
            Submit Initial Version (v001)
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {versions.map((ver, idx) => {
            const isCurrent = ver.code?.includes(shot.current_version) || idx === 0;

            return (
              <Card
                key={ver.id || idx}
                className={`border bg-slate-900 overflow-hidden shadow-md transition-all hover:border-slate-700 ${
                  isCurrent ? 'border-indigo-500/50 ring-1 ring-indigo-500/20' : 'border-slate-800'
                }`}
              >
                {/* Media thumbnail */}
                <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden group">
                  {ver.thumbnail_url || shot.thumbnail_url ? (
                    <SmartImg
                      src={ver.thumbnail_url || shot.thumbnail_url}
                      alt={ver.code}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="text-slate-600 flex flex-col items-center gap-1">
                      <Play className="w-8 h-8" />
                      <span className="text-[10px] font-mono">Render Preview</span>
                    </div>
                  )}

                  <div className="absolute top-2 left-2 flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded bg-black/80 backdrop-blur-md text-[10px] font-mono text-indigo-300 font-bold border border-indigo-500/30">
                      {ver.code || `v00${idx + 1}`}
                    </span>
                    {isCurrent && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-mono border border-emerald-500/30 font-bold">
                        HERO
                      </span>
                    )}
                  </div>

                  <div className="absolute bottom-2 right-2">
                    <StatusBadge status={ver.status} />
                  </div>
                </div>

                <CardBody className="p-3.5 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white truncate font-mono">
                        {ver.code || `${shot.code}_comp_v00${idx + 1}`}
                      </h4>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        By {ver.artist_name || shot.assigned_artist_name || 'Elena Rostova'} • {ver.department || 'Compositing'}
                      </div>
                    </div>
                  </div>

                  {((ver as any).comment || ver.description || ver.notes) && (
                    <p className="text-[11px] text-slate-300 italic line-clamp-2 bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                      "{(ver as any).comment || ver.description || ver.notes}"
                    </p>
                  )}

                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-2 border-t border-slate-800">
                    <span>{ver.frame_count || shot.frame_count} frames</span>
                    <WorkspaceOpenButton
                      to={`/versions/${ver.id}`}
                      title="Open Version Workspace"
                    />
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
