import React from 'react';
import { Search, Filter, X, SlidersHorizontal, ArrowUpDown, Layers, RefreshCw } from 'lucide-react';
import { FieldDefinition } from '@/types/crud';
import { Button } from '@/shared/components/Button';

interface QuickFilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeFilterCount: number;
  onOpenAdvancedFilters: () => void;
  onResetFilters: () => void;
  quickFilterOptions?: {
    label: string;
    field: string;
    options: { label: string; value: string }[];
    selected: string[];
    onToggle: (value: string) => void;
  }[];
  className?: string;
}

export const QuickFilterBar: React.FC<QuickFilterBarProps> = ({
  searchQuery,
  onSearchChange,
  activeFilterCount,
  onOpenAdvancedFilters,
  onResetFilters,
  quickFilterOptions = [],
  className = '',
}) => {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 ${className}`}>
      {/* Search Input and Filter button */}
      <div className="flex items-center gap-2.5 flex-1 min-w-[280px]">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search all records, codes, titles, artists..."
            className="w-full pl-9 pr-8 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Builder Trigger */}
        <button
          type="button"
          onClick={onOpenAdvancedFilters}
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
            activeFilterCount > 0
              ? 'bg-indigo-600/10 border-indigo-500/50 text-indigo-300 hover:bg-indigo-600/20'
              : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>

        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={onResetFilters}
            className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors px-2 py-1"
            title="Clear all filters"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Quick Filter Pill Groups */}
      {quickFilterOptions.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
          {quickFilterOptions.map((qGroup) => (
            <div key={qGroup.field} className="flex items-center gap-1 bg-slate-900/60 p-1 rounded-lg border border-slate-800">
              <span className="text-[11px] text-slate-500 font-semibold px-1.5">
                {qGroup.label}:
              </span>
              {qGroup.options.map((opt) => {
                const isSelected = qGroup.selected.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => qGroup.onToggle(opt.value)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
