import React, { useState } from 'react';
import {
  UniversalEntityType,
  EntityReference,
  WorkspaceDisplayMode,
} from '@/types/workspace';
import { resolveEntity, formatEntityType } from '@/core/workspace/entityRegistry';
import { useWorkspaceStore } from '@/core/workspace/useWorkspaceStore';
import {
  Eye,
  Columns,
  PanelRight,
  Maximize2,
  ExternalLink,
  Layers,
  Box,
  Clapperboard,
  CheckSquare,
  PlaySquare,
  Building2,
  Briefcase,
  Users,
  Film,
  FileCode,
  Calendar,
  Truck,
  HardDrive,
} from 'lucide-react';
import { cn } from '@/shared/utils/cn';

interface EntityRefProps {
  type: UniversalEntityType;
  id: string;
  code?: string;
  title?: string;
  status?: string;
  subtitle?: string;
  thumbnail_url?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'badge' | 'card' | 'inline' | 'button';
  defaultAction?: WorkspaceDisplayMode;
  showHoverCard?: boolean;
}

export const getEntityIcon = (type: UniversalEntityType) => {
  switch (type) {
    case 'organization':
      return Building2;
    case 'client':
      return Briefcase;
    case 'vendor':
      return Briefcase;
    case 'person':
      return Users;
    case 'department':
      return Layers;
    case 'team':
      return Users;
    case 'office':
      return Building2;
    case 'project':
      return Film;
    case 'sequence':
      return Layers;
    case 'shot':
      return Clapperboard;
    case 'asset':
      return Box;
    case 'task':
      return CheckSquare;
    case 'version':
      return FileCode;
    case 'review':
      return PlaySquare;
    case 'note':
      return FileCode;
    case 'delivery':
      return Truck;
    case 'schedule':
      return Calendar;
    case 'resource':
      return HardDrive;
    default:
      return Layers;
  }
};

export const getEntityColorClass = (type: UniversalEntityType) => {
  switch (type) {
    case 'organization':
      return 'text-purple-400 bg-purple-950/40 border-purple-800/60 hover:border-purple-600';
    case 'client':
      return 'text-blue-400 bg-blue-950/40 border-blue-800/60 hover:border-blue-600';
    case 'vendor':
      return 'text-amber-400 bg-amber-950/40 border-amber-800/60 hover:border-amber-600';
    case 'person':
      return 'text-emerald-400 bg-emerald-950/40 border-emerald-800/60 hover:border-emerald-600';
    case 'project':
      return 'text-indigo-400 bg-indigo-950/40 border-indigo-800/60 hover:border-indigo-600';
    case 'shot':
      return 'text-cyan-400 bg-cyan-950/40 border-cyan-800/60 hover:border-cyan-600';
    case 'asset':
      return 'text-teal-400 bg-teal-950/40 border-teal-800/60 hover:border-teal-600';
    case 'task':
      return 'text-yellow-400 bg-yellow-950/40 border-yellow-800/60 hover:border-yellow-600';
    case 'version':
      return 'text-violet-400 bg-violet-950/40 border-violet-800/60 hover:border-violet-600';
    case 'review':
      return 'text-rose-400 bg-rose-950/40 border-rose-800/60 hover:border-rose-600';
    default:
      return 'text-slate-300 bg-slate-900 border-slate-800 hover:border-slate-700';
  }
};

export const EntityRef: React.FC<EntityRefProps> = ({
  type,
  id,
  code,
  title,
  status,
  subtitle,
  thumbnail_url,
  className,
  size = 'md',
  variant = 'badge',
  defaultAction = 'peek',
  showHoverCard = true,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [hoverTimeout, setHoverTimeout] = useState<any>(null);
  const { openInWorkspace, openPeek, openDrawer } = useWorkspaceStore();

  const Icon = getEntityIcon(type);
  const colorClasses = getEntityColorClass(type);

  const displayCode = code || id;
  const displayTitle = title || displayCode;

  const entityRefData: EntityReference = {
    id,
    type,
    code: displayCode,
    title: displayTitle,
    status,
    subtitle,
    thumbnail_url,
  };

  const handleMouseEnter = () => {
    if (!showHoverCard) return;
    const t = setTimeout(() => setIsHovered(true), 350);
    setHoverTimeout(t);
  };

  const handleMouseLeave = () => {
    if (hoverTimeout) clearTimeout(hoverTimeout);
    setIsHovered(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    openInWorkspace(entityRefData, defaultAction);
  };

  const resolved = isHovered ? resolveEntity(type, id) : null;

  return (
    <div
      className="relative inline-flex items-center group"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Visual Trigger */}
      {variant === 'badge' && (
        <button
          onClick={handleClick}
          className={cn(
            'inline-flex items-center gap-1.5 font-mono rounded-lg border transition-all text-left select-none',
            size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
            colorClasses,
            className
          )}
          title={`Click to open ${formatEntityType(type)} in workspace`}
        >
          <Icon className={size === 'sm' ? 'w-3 h-3 shrink-0' : 'w-3.5 h-3.5 shrink-0'} />
          <span className="font-bold truncate max-w-[160px]">{displayCode}</span>
          {title && title !== displayCode && (
            <span className="text-[10px] opacity-75 truncate max-w-[120px] hidden sm:inline">
              {title}
            </span>
          )}
        </button>
      )}

      {variant === 'inline' && (
        <button
          onClick={handleClick}
          className={cn(
            'inline-flex items-center gap-1 text-slate-300 hover:text-white font-mono hover:underline transition-colors',
            size === 'sm' ? 'text-xs' : 'text-sm',
            className
          )}
        >
          <Icon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span>{displayTitle}</span>
        </button>
      )}

      {variant === 'card' && (
        <div
          onClick={handleClick}
          className={cn(
            'p-3 rounded-xl border border-slate-800 bg-slate-950/80 hover:bg-slate-900/90 hover:border-slate-700 cursor-pointer transition-all flex items-center justify-between gap-3 w-full',
            className
          )}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={cn('p-1.5 rounded-lg border', colorClasses)}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-mono font-bold text-white truncate">{displayCode}</span>
                {status && (
                  <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-300 font-mono">
                    {status}
                  </span>
                )}
              </div>
              {title && <p className="text-[11px] text-slate-400 truncate">{title}</p>}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100">
            <button
              onClick={(e) => {
                e.stopPropagation();
                openPeek(entityRefData);
              }}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
              title="Quick Peek"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                openInWorkspace(entityRefData, 'split');
              }}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
              title="Open in Split View"
            >
              <Columns className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Non-Linear Floating Hover Card */}
      {isHovered && showHoverCard && (
        <div className="absolute z-50 bottom-full left-0 mb-2 w-72 sm:w-80 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl p-3.5 font-sans animate-in fade-in zoom-in-95 duration-150 pointer-events-auto">
          <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2 min-w-0">
              <div className={cn('p-1.5 rounded-lg border shrink-0', colorClasses)}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-mono uppercase text-slate-400 block font-semibold">
                  {formatEntityType(type)}
                </span>
                <h4 className="text-xs font-bold text-white truncate font-mono">
                  {resolved?.code || displayCode}
                </h4>
              </div>
            </div>

            {resolved?.status && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-indigo-300 shrink-0">
                {resolved.status}
              </span>
            )}
          </div>

          {resolved?.title && (
            <p className="text-xs text-slate-200 mt-2 font-medium leading-snug line-clamp-2">
              {resolved.title}
            </p>
          )}

          {resolved?.subtitle && (
            <p className="text-[11px] text-slate-400 mt-0.5 font-mono">{resolved.subtitle}</p>
          )}

          {/* Quick Properties Snapshot */}
          {resolved?.properties && (
            <div className="mt-2.5 pt-2 border-t border-slate-800/80 grid grid-cols-2 gap-1.5 text-[10px] font-mono">
              {Object.entries(resolved.properties)
                .slice(0, 4)
                .map(([k, v]) => (
                  <div key={k} className="bg-slate-950/60 px-2 py-1 rounded border border-slate-800/60">
                    <span className="text-slate-500 block truncate">{k}</span>
                    <span className="text-slate-200 font-semibold truncate block">{String(v)}</span>
                  </div>
                ))}
            </div>
          )}

          {/* Workspace Action Buttons */}
          <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between gap-1 text-[11px]">
            <button
              onClick={(e) => {
                e.stopPropagation();
                openPeek(entityRefData);
              }}
              className="flex-1 py-1 px-1.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white flex items-center justify-center gap-1"
            >
              <Eye className="w-3 h-3 text-cyan-400" />
              <span>Peek</span>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                openInWorkspace(entityRefData, 'split');
              }}
              className="flex-1 py-1 px-1.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white flex items-center justify-center gap-1"
            >
              <Columns className="w-3 h-3 text-indigo-400" />
              <span>Split</span>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                openDrawer(entityRefData);
              }}
              className="flex-1 py-1 px-1.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white flex items-center justify-center gap-1"
            >
              <PanelRight className="w-3 h-3 text-purple-400" />
              <span>Drawer</span>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                openInWorkspace(entityRefData, 'full');
              }}
              className="py-1 px-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium flex items-center justify-center gap-1"
              title="Open Full Page View"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
