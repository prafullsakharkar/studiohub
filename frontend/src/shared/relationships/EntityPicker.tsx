import React, { useState } from 'react';
import { Search, Check, Layers, Filter, X } from 'lucide-react';
import { EntityType, EntityId, EntityReference } from '@/types/crud';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { ENTITY_CONFIGS, searchAllEntities } from './entityRegistry';

interface EntityPickerProps {
  isOpen: boolean;
  title?: string;
  allowedTypes?: EntityType[];
  initialType?: EntityType;
  selectedIds?: EntityId[];
  isMulti?: boolean;
  onClose: () => void;
  onSelect: (selected: EntityReference[]) => void;
}

export const EntityPicker: React.FC<EntityPickerProps> = ({
  isOpen,
  title = 'Select Entity Reference',
  allowedTypes = [
    'project',
    'shot',
    'asset',
    'task',
    'version',
    'review',
    'client',
    'vendor',
    'person',
    'team',
  ],
  initialType,
  selectedIds = [],
  isMulti = false,
  onClose,
  onSelect,
}) => {
  const [activeType, setActiveType] = useState<EntityType | 'all'>(
    initialType || (allowedTypes.length === 1 ? allowedTypes[0] : 'all')
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMap, setSelectedMap] = useState<Record<string, EntityReference>>({});

  const typesToSearch =
    activeType === 'all' ? allowedTypes : [activeType];

  const results = searchAllEntities(searchQuery, typesToSearch, 30);

  const toggleSelect = (item: EntityReference) => {
    if (isMulti) {
      setSelectedMap((prev) => {
        const next = { ...prev };
        if (next[item.id]) {
          delete next[item.id];
        } else {
          next[item.id] = item;
        }
        return next;
      });
    } else {
      onSelect([item]);
      onClose();
    }
  };

  const handleConfirmMulti = () => {
    onSelect(Object.values(selectedMap));
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="xl"
      footer={
        isMulti ? (
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-slate-400">
              {Object.keys(selectedMap).length} items selected
            </span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmMulti}
                disabled={Object.keys(selectedMap).length === 0}
              >
                Confirm Selection ({Object.keys(selectedMap).length})
              </Button>
            </div>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {/* Entity Type Tabs */}
        {allowedTypes.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-800 scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveType('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                activeType === 'all'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              All Types
            </button>
            {allowedTypes.map((type) => {
              const config = ENTITY_CONFIGS[type];
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setActiveType(type)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    activeType === type
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {config?.pluralLabel || type}
                </button>
              );
            })}
          </div>
        )}

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by code, title, name, or ID..."
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Catalog Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-96 overflow-y-auto pr-1">
          {results.length === 0 ? (
            <div className="col-span-2 text-center py-12 text-slate-500 text-xs">
              No matching records found.
            </div>
          ) : (
            results.map((item) => {
              const isSelected = isMulti
                ? !!selectedMap[item.id]
                : selectedIds.includes(item.id);
              const config = ENTITY_CONFIGS[item.type];

              return (
                <div
                  key={`${item.type}-${item.id}`}
                  onClick={() => toggleSelect(item)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-indigo-950/40 border-indigo-500 text-slate-100'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {item.avatarUrl ? (
                      <img
                        src={item.avatarUrl}
                        alt=""
                        className="w-8 h-8 rounded-lg object-cover flex-shrink-0 border border-slate-800"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${config?.badgeBg || 'bg-slate-800'}`}>
                        {item.type}
                      </span>
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {item.code && (
                          <span className="font-mono text-xs text-slate-400 font-semibold">{item.code}</span>
                        )}
                        <span className="text-xs font-medium truncate">{item.label}</span>
                      </div>
                      {item.subtitle && (
                        <p className="text-[11px] text-slate-500 truncate">{item.subtitle}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {item.status && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                        {item.status}
                      </span>
                    )}
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-white">
                        <Check className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
};
