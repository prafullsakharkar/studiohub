import React, { useState } from 'react';
import { Search, X, Plus, Trash2, ExternalLink } from 'lucide-react';
import { EntityType, EntityReference } from '@/types/crud';
import { EntityReferenceComponent } from './EntityReference';
import { ENTITY_CONFIGS } from './entityRegistry';

interface RelationshipListProps {
  title?: string;
  targetType: EntityType;
  items: EntityReference[];
  onAdd?: () => void;
  onRemove?: (id: string) => void;
  readOnly?: boolean;
  emptyMessage?: string;
  className?: string;
}

export const RelationshipList: React.FC<RelationshipListProps> = ({
  title,
  targetType,
  items,
  onAdd,
  onRemove,
  readOnly = false,
  emptyMessage = 'No connected references',
  className = '',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const config = ENTITY_CONFIGS[targetType] || ENTITY_CONFIGS.project;

  const filteredItems = items.filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.label?.toLowerCase().includes(q) ||
      item.code?.toLowerCase().includes(q) ||
      item.id.toLowerCase().includes(q)
    );
  });

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {title && <span className="text-xs font-semibold text-slate-300">{title}</span>}
          <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
            {items.length} {items.length === 1 ? config.label : config.pluralLabel}
          </span>
        </div>

        {!readOnly && onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add {config.label}</span>
          </button>
        )}
      </div>

      {/* Quick Search if more than 4 items */}
      {items.length > 4 && (
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Filter ${config.pluralLabel.toLowerCase()}...`}
            className="w-full pl-8 pr-3 py-1 bg-slate-900 border border-slate-800 rounded-md text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          />
        </div>
      )}

      {/* Items list */}
      {filteredItems.length === 0 ? (
        <div className="p-4 rounded-lg bg-slate-950/30 border border-slate-800/60 text-center text-xs text-slate-500">
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors group"
            >
              <EntityReferenceComponent
                type={item.type || targetType}
                reference={item}
                variant="pill"
                showAvatar
                showCode
                showStatus
              />

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {!readOnly && onRemove && (
                  <button
                    type="button"
                    onClick={() => onRemove(item.id)}
                    className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title="Remove relation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
