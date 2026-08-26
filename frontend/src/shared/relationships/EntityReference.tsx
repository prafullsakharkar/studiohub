import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
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
import { EntityType, EntityId, EntityReference as EntityReferenceType } from '@/types/crud';
import { ENTITY_CONFIGS, resolveEntityReference } from './entityRegistry';
import { EntityPreview } from './EntityPreview';

interface EntityReferenceProps {
  type: EntityType;
  id?: EntityId;
  reference?: EntityReferenceType;
  variant?: 'pill' | 'card' | 'link' | 'avatar' | 'compact';
  showAvatar?: boolean;
  showCode?: boolean;
  showStatus?: boolean;
  showPreviewOnHover?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
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

export const EntityReferenceComponent: React.FC<EntityReferenceProps> = ({
  type,
  id,
  reference: initialReference,
  variant = 'pill',
  showAvatar = true,
  showCode = true,
  showStatus = false,
  showPreviewOnHover = true,
  onClick,
  className = '',
}) => {
  const navigate = useNavigate();
  const [showPreview, setShowPreview] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Resolve reference from ID if initialReference is not passed
  const reference: EntityReferenceType | null =
    initialReference || (id ? resolveEntityReference(type, id) : null);

  const config = ENTITY_CONFIGS[type] || ENTITY_CONFIGS.project;
  const IconComponent = ICON_MAP[type] || Clapperboard;

  if (!reference) {
    return (
      <span className="inline-flex items-center text-xs text-slate-500 font-mono italic">
        —
      </span>
    );
  }

  const handleMouseEnter = () => {
    if (!showPreviewOnHover) return;
    hoverTimeoutRef.current = setTimeout(() => {
      setShowPreview(true);
    }, 250);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setShowPreview(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      onClick(e);
      return;
    }
    // Default: navigate to entity workspace
    navigate(`${config.routePrefix}/${reference.id}`);
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {variant === 'avatar' && (
        <button
          type="button"
          onClick={handleClick}
          title={`${config.label}: ${reference.label || reference.id}`}
          className={`relative inline-flex items-center justify-center w-7 h-7 rounded-full overflow-hidden border border-slate-700 bg-slate-800 hover:ring-2 hover:ring-indigo-500 transition-all ${className}`}
        >
          {reference.avatarUrl ? (
            <img
              src={reference.avatarUrl}
              alt={reference.label}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <IconComponent className="w-3.5 h-3.5 text-slate-400" />
          )}
        </button>
      )}

      {variant === 'link' && (
        <button
          type="button"
          onClick={handleClick}
          className={`inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-indigo-400 transition-colors ${className}`}
        >
          <IconComponent className={`w-3.5 h-3.5 ${config.colorClass}`} />
          <span>{reference.label || reference.code || reference.id}</span>
        </button>
      )}

      {variant === 'compact' && (
        <button
          type="button"
          onClick={handleClick}
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-all ${className}`}
        >
          <IconComponent className={`w-3 h-3 ${config.colorClass}`} />
          <span className="font-semibold text-slate-200">{reference.code || reference.id}</span>
        </button>
      )}

      {variant === 'pill' && (
        <button
          type="button"
          onClick={handleClick}
          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700/80 text-slate-200 transition-all group ${className}`}
        >
          {showAvatar && reference.avatarUrl ? (
            <img
              src={reference.avatarUrl}
              alt=""
              className="w-4 h-4 rounded-full object-cover flex-shrink-0"
              referrerPolicy="no-referrer"
            />
          ) : (
            <IconComponent className={`w-3.5 h-3.5 flex-shrink-0 ${config.colorClass}`} />
          )}

          {showCode && reference.code && (
            <span className="font-mono text-[11px] text-slate-400 group-hover:text-slate-300">
              {reference.code}
            </span>
          )}

          <span className="truncate max-w-[140px]">
            {reference.label || reference.id}
          </span>

          {showStatus && reference.status && (
            <span className="text-[10px] px-1 py-0.2 rounded bg-slate-700 text-slate-300">
              {reference.status}
            </span>
          )}
        </button>
      )}

      {variant === 'card' && (
        <div
          onClick={handleClick}
          className={`p-3 rounded-lg bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer flex items-center justify-between gap-3 ${className}`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {reference.avatarUrl ? (
              <img
                src={reference.avatarUrl}
                alt=""
                className="w-8 h-8 rounded-lg object-cover flex-shrink-0 border border-slate-800"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className={`p-2 rounded-lg ${config.badgeBg} flex-shrink-0`}>
                <IconComponent className="w-4 h-4" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                {reference.code && (
                  <span className="font-mono text-xs font-semibold text-slate-300">
                    {reference.code}
                  </span>
                )}
                <span className="text-xs font-medium text-slate-200 truncate">
                  {reference.label}
                </span>
              </div>
              {reference.subtitle && (
                <p className="text-[11px] text-slate-500 truncate">{reference.subtitle}</p>
              )}
            </div>
          </div>

          {reference.status && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono flex-shrink-0">
              {reference.status}
            </span>
          )}
        </div>
      )}

      {/* Flyout Hover Preview */}
      {showPreview && (
        <div
          className="absolute left-0 top-full mt-2 z-50 animate-in fade-in zoom-in-95 duration-150"
          style={{ transform: 'translateX(-10%)' }}
        >
          <EntityPreview
            reference={reference}
            onClose={() => setShowPreview(false)}
          />
        </div>
      )}
    </div>
  );
};

export { EntityReferenceComponent as EntityReference };
