import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ExternalLink,
  Copy,
  Check,
  Clapperboard,
  Film,
  Boxes,
  CheckSquare,
  Layers,
  Eye,
  Building2,
  Truck,
  User,
  Users,
  Briefcase,
  MapPin,
  Globe,
} from 'lucide-react';
import { EntityReference, EntityType } from '@/types/crud';
import { ENTITY_CONFIGS, resolveEntityRaw } from './entityRegistry';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Button } from '@/shared/components/Button';

interface EntityPreviewProps {
  reference: EntityReference;
  onClose?: () => void;
  onNavigate?: (path: string) => void;
}

const ICON_MAP: Record<EntityType, React.ComponentType<{ className?: string }>> = {
  project: Clapperboard,
  shot: Film,
  asset: Boxes,
  task: CheckSquare,
  version: Layers,
  review: Eye,
  client: Building2,
  vendor: Truck,
  person: User,
  team: Users,
  department: Briefcase,
  office: MapPin,
  organization: Globe,
};

export const EntityPreview: React.FC<EntityPreviewProps> = ({
  reference,
  onClose,
  onNavigate,
}) => {
  const navigate = useNavigate();
  const [copied, setCopied] = React.useState(false);
  const config = ENTITY_CONFIGS[reference.type] || ENTITY_CONFIGS.project;
  const IconComponent = ICON_MAP[reference.type] || Clapperboard;
  const rawData = resolveEntityRaw(reference.type, reference.id);

  const handleCopyId = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(reference.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenTarget = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClose) onClose();
    const targetUrl = `${config.routePrefix}/${reference.id}`;
    if (onNavigate) {
      onNavigate(targetUrl);
    } else {
      navigate(targetUrl);
    }
  };

  return (
    <div className="w-80 rounded-xl bg-slate-900 border border-slate-700/80 shadow-2xl p-4 text-slate-200 z-50 text-left">
      {/* Header Banner / Type pill */}
      <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${config.badgeBg} flex items-center justify-center`}>
            <IconComponent className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {config.label}
            </span>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <span>{reference.code || reference.id}</span>
              <button
                onClick={handleCopyId}
                className="text-slate-400 hover:text-slate-200 p-0.5 rounded transition-colors"
                title="Copy Entity ID"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </div>

        {reference.status && (
          <StatusBadge status={reference.status as any} size="sm" />
        )}
      </div>

      {/* Main Identity Content */}
      <div className="space-y-3">
        <div>
          <h4 className="font-semibold text-sm text-slate-100 line-clamp-2">
            {reference.label || `${config.label} #${reference.id}`}
          </h4>
          {reference.subtitle && (
            <p className="text-xs text-slate-400 mt-0.5">{reference.subtitle}</p>
          )}
        </div>

        {/* Thumbnail Preview Plate if available */}
        {reference.avatarUrl && (
          <div className="rounded-lg overflow-hidden border border-slate-800 aspect-video bg-slate-950/60 relative">
            <img
              src={reference.avatarUrl}
              alt={reference.label}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            {rawData?.fps && (
              <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur text-[10px] font-mono text-slate-300">
                {rawData.fps} fps
              </span>
            )}
          </div>
        )}

        {/* Quick Specs Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60 font-mono">
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">ID Ref</span>
            <span className="text-slate-300 truncate block">{reference.id}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Type</span>
            <span className="text-slate-300 capitalize">{reference.type}</span>
          </div>
          {rawData?.due_date && (
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Due Date</span>
              <span className="text-amber-300/90">{rawData.due_date}</span>
            </div>
          )}
          {rawData?.priority && (
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Priority</span>
              <span className="text-slate-300">{rawData.priority}</span>
            </div>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
        <span className="text-[11px] text-slate-400">Canonical reference backed</span>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleOpenTarget}
          className="gap-1.5 text-xs py-1 px-2.5 h-auto bg-slate-800 hover:bg-slate-700"
        >
          <span>Open {config.label}</span>
          <ExternalLink className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
};
