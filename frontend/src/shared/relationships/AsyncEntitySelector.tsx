import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Check, Loader2, ChevronDown } from 'lucide-react';
import { EntityType, EntityId, EntityReference } from '@/types/crud';
import { ENTITY_CONFIGS, searchAllEntities, resolveEntityReference } from './entityRegistry';
import { EntityReferenceComponent } from './EntityReference';

interface AsyncEntitySelectorProps {
  entityType?: EntityType;
  allowedTypes?: EntityType[];
  value?: EntityId | EntityId[];
  isMulti?: boolean;
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: EntityId | EntityId[] | null) => void;
  className?: string;
}

export const AsyncEntitySelector: React.FC<AsyncEntitySelectorProps> = ({
  entityType,
  allowedTypes,
  value,
  isMulti = false,
  placeholder = 'Search & connect reference...',
  disabled = false,
  onChange,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<EntityReference[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const targetTypes = allowedTypes || (entityType ? [entityType] : undefined);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch / search entities on query or open
  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    const timer = setTimeout(() => {
      const found = searchAllEntities(query, targetTypes, 15);
      setResults(found);
      setIsLoading(false);
    }, 120);

    return () => clearTimeout(timer);
  }, [query, isOpen, targetTypes]);

  // Selected references resolution
  const selectedIds: string[] = isMulti
    ? (Array.isArray(value) ? value : value ? [value] : [])
    : (value && typeof value === 'string' ? [value] : []);

  const selectedReferences: EntityReference[] = selectedIds
    .map((id) => resolveEntityReference(entityType || 'project', id))
    .filter(Boolean) as EntityReference[];

  const handleSelect = (item: EntityReference) => {
    if (isMulti) {
      const exists = selectedIds.includes(item.id);
      const next = exists
        ? selectedIds.filter((id) => id !== item.id)
        : [...selectedIds, item.id];
      onChange(next);
    } else {
      onChange(item.id);
      setIsOpen(false);
    }
  };

  const handleRemove = (idToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMulti) {
      onChange(selectedIds.filter((id) => id !== idToRemove));
    } else {
      onChange(null);
    }
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Control Box */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-900 border ${
          isOpen ? 'border-indigo-500 ring-1 ring-indigo-500/30' : 'border-slate-800'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-slate-700'} transition-all flex items-center justify-between gap-2`}
      >
        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
          {selectedReferences.length === 0 ? (
            <span className="text-xs text-slate-500 select-none">
              {placeholder}
            </span>
          ) : (
            selectedReferences.map((ref) => (
              <span
                key={ref.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-xs text-slate-200"
              >
                <span className="font-mono text-[10px] text-slate-400">{ref.code || ref.id}</span>
                <span className="truncate max-w-[120px]">{ref.label}</span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => handleRemove(ref.id, e)}
                    className="text-slate-400 hover:text-rose-400 ml-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            ))
          )}
        </div>

        <div className="flex items-center gap-1 text-slate-500">
          {selectedIds.length > 0 && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange(isMulti ? [] : null);
              }}
              className="p-1 hover:text-slate-300"
              title="Clear all"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl bg-slate-900 border border-slate-700/80 shadow-2xl overflow-hidden p-2 space-y-2 animate-in fade-in zoom-in-95 duration-100 max-h-72 flex flex-col">
          {/* Search input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type to search entities..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Results List */}
          <div className="overflow-y-auto flex-1 space-y-1 pr-0.5">
            {isLoading ? (
              <div className="flex items-center justify-center py-6 text-slate-500 text-xs gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                <span>Searching catalog...</span>
              </div>
            ) : results.length === 0 ? (
              <div className="py-6 text-center text-slate-500 text-xs">
                No matching entities found
              </div>
            ) : (
              results.map((item) => {
                const isSelected = selectedIds.includes(item.id);
                const config = ENTITY_CONFIGS[item.type];
                return (
                  <div
                    key={`${item.type}-${item.id}`}
                    onClick={() => handleSelect(item)}
                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-indigo-600/20 border border-indigo-500/40 text-slate-100'
                        : 'hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {item.avatarUrl ? (
                        <img
                          src={item.avatarUrl}
                          alt=""
                          className="w-6 h-6 rounded-md object-cover flex-shrink-0"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${config?.badgeBg || 'bg-slate-800 text-slate-400'}`}>
                          {item.type}
                        </span>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          {item.code && (
                            <span className="font-mono text-xs text-slate-400">{item.code}</span>
                          )}
                          <span className="text-xs font-medium truncate">{item.label}</span>
                        </div>
                        {item.subtitle && (
                          <p className="text-[10px] text-slate-500 truncate">{item.subtitle}</p>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
