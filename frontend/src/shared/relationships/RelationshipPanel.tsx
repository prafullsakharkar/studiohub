import React from 'react';
import { Network, Plus, ArrowUpRight, ChevronRight, Layers } from 'lucide-react';
import { EntityType, EntityId, EntityReference } from '@/types/crud';
import { getRelatedEntities, RelatedEntityGroup, ENTITY_CONFIGS } from './entityRegistry';
import { EntityReferenceComponent } from './EntityReference';
import { Button } from '@/shared/components/Button';

interface RelationshipPanelProps {
  entityType: EntityType;
  entityId: EntityId;
  onLinkNew?: (groupType: string) => void;
  className?: string;
}

export const RelationshipPanel: React.FC<RelationshipPanelProps> = ({
  entityType,
  entityId,
  onLinkNew,
  className = '',
}) => {
  const groups: RelatedEntityGroup[] = getRelatedEntities(entityType, entityId);
  const config = ENTITY_CONFIGS[entityType];

  return (
    <div className={`rounded-xl bg-slate-900/70 border border-slate-800 p-4 space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Network className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-200">
              Relationship Graph
            </h4>
            <p className="text-xs text-slate-400">
              Connected canonical nodes for {config?.label || entityType}
            </p>
          </div>
        </div>

        <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
          {groups.reduce((acc, g) => acc + g.count, 0)} Links
        </span>
      </div>

      {/* Relationship Groups */}
      {groups.length === 0 ? (
        <div className="text-center py-6 text-slate-400 text-xs">
          No external entity links registered for this item.
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => {
            const targetConfig = ENTITY_CONFIGS[group.targetType];
            return (
              <div
                key={group.relationshipType}
                className="space-y-2 rounded-lg bg-slate-950/40 p-3 border border-slate-800/60"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-300">
                      {group.label}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                      {group.count}
                    </span>
                  </div>

                  {onLinkNew && (
                    <button
                      type="button"
                      onClick={() => onLinkNew(group.relationshipType)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Link</span>
                    </button>
                  )}
                </div>

                {/* Entity references pills/cards */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {group.entities.map((ref) => (
                    <EntityReferenceComponent
                      key={`${ref.type}-${ref.id}`}
                      type={ref.type}
                      reference={ref}
                      variant="pill"
                      showAvatar
                      showCode
                      showStatus
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
