import React, { useState } from 'react';
import { Network, Plus, ExternalLink } from 'lucide-react';
import { EntityType, EntityId, EntityReference } from '@/types/crud';
import { getRelatedEntities, ENTITY_CONFIGS } from './entityRegistry';
import { EntityReferenceComponent } from './EntityReference';
import { EntityPicker } from './EntityPicker';
import { Button } from '@/shared/components/Button';

interface RelatedEntitiesProps {
  entityType: EntityType;
  entityId: EntityId;
  title?: string;
  readOnly?: boolean;
  onLinkAdded?: (targetReference: EntityReference, groupType: string) => void;
  className?: string;
}

export const RelatedEntities: React.FC<RelatedEntitiesProps> = ({
  entityType,
  entityId,
  title,
  readOnly = false,
  onLinkAdded,
  className = '',
}) => {
  const groups = getRelatedEntities(entityType, entityId);
  const [activeGroupIndex, setActiveGroupIndex] = useState(0);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const currentGroup = groups[activeGroupIndex] || groups[0];

  const handleSelectFromPicker = (selectedRefs: EntityReference[]) => {
    if (selectedRefs.length > 0 && onLinkAdded && currentGroup) {
      selectedRefs.forEach((ref) => onLinkAdded(ref, currentGroup.relationshipType));
    }
  };

  if (groups.length === 0) {
    return (
      <div className={`p-6 rounded-xl bg-slate-900/50 border border-slate-800 text-center ${className}`}>
        <Network className="w-8 h-8 mx-auto text-slate-600 mb-2" />
        <h5 className="text-sm font-semibold text-slate-300">No Related Entities</h5>
        <p className="text-xs text-slate-500 mt-1">
          This {entityType} currently has no registered cross-entity relationships.
        </p>
      </div>
    );
  }

  return (
    <div className={`rounded-xl bg-slate-900/80 border border-slate-800 overflow-hidden ${className}`}>
      {/* Header with relationship tabs */}
      <div className="border-b border-slate-800 bg-slate-950/40 p-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          {groups.map((g, idx) => {
            const isActive = idx === activeGroupIndex;
            const targetConfig = ENTITY_CONFIGS[g.targetType];
            return (
              <button
                key={g.relationshipType}
                type="button"
                onClick={() => setActiveGroupIndex(idx)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-slate-800 text-slate-100 border border-slate-700 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <span>{g.label}</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${isActive ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                  {g.count}
                </span>
              </button>
            );
          })}
        </div>

        {!readOnly && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsPickerOpen(true)}
            className="gap-1 text-xs py-1 px-2.5 h-auto flex-shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Connect {currentGroup ? ENTITY_CONFIGS[currentGroup.targetType]?.label : ''}</span>
          </Button>
        )}
      </div>

      {/* Active Tab Content Grid */}
      <div className="p-4">
        {currentGroup && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {currentGroup.entities.map((ref) => (
              <EntityReferenceComponent
                key={`${ref.type}-${ref.id}`}
                type={ref.type}
                reference={ref}
                variant="card"
                showAvatar
                showCode
                showStatus
              />
            ))}
          </div>
        )}
      </div>

      {/* Connect Entity Picker Modal */}
      {currentGroup && (
        <EntityPicker
          isOpen={isPickerOpen}
          title={`Link ${currentGroup.label}`}
          allowedTypes={[currentGroup.targetType]}
          initialType={currentGroup.targetType}
          isMulti
          onClose={() => setIsPickerOpen(false)}
          onSelect={handleSelectFromPicker}
        />
      )}
    </div>
  );
};
