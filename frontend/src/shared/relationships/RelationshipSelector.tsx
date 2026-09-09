import React from 'react';
import { EntityType, EntityId } from '@/types/crud';
import { AsyncEntitySelector } from './AsyncEntitySelector';
import { ENTITY_CONFIGS } from './entityRegistry';

interface RelationshipSelectorProps {
  label?: string;
  sourceType?: EntityType;
  targetType: EntityType;
  value?: EntityId | EntityId[];
  isMulti?: boolean;
  required?: boolean;
  description?: string;
  onChange: (value: EntityId | EntityId[] | null) => void;
  className?: string;
}

export const RelationshipSelector: React.FC<RelationshipSelectorProps> = ({
  label,
  sourceType,
  targetType,
  value,
  isMulti = false,
  required = false,
  description,
  onChange,
  className = '',
}) => {
  const config = ENTITY_CONFIGS[targetType] || ENTITY_CONFIGS.project;

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="block text-xs font-semibold text-slate-300">
            {label} {required && <span className="text-rose-400">*</span>}
          </label>
          <span className="text-[10px] text-slate-500 font-mono">
            Ref: {config.label}
          </span>
        </div>
      )}

      <AsyncEntitySelector
        entityType={targetType}
        value={value}
        isMulti={isMulti}
        placeholder={`Select ${config.label}...`}
        onChange={onChange}
      />

      {description && (
        <p className="text-[11px] text-slate-500">{description}</p>
      )}
    </div>
  );
};
