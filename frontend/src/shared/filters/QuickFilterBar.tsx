import type React from 'react';
import { Filter, SlidersHorizontal, ArrowUpDown, Layers, RefreshCw } from 'lucide-react';
import { FieldDefinition } from '@/types/common';
import { Button } from '@/shared/components/Button';
import { SearchInput } from '@/shared/components/SearchInput';

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
        <div className="flex-1 max-w-md">
          <SearchInput
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onClear={() => onSearchChange('')}
            placeholder="Search all records, codes, titles, artists..."
            className="w-full"
          />
        </div>

        {/* Filter Builder Trigger */}
        <button
          type="button"
          onClick={onOpenAdvancedFilters}
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
            activeFilterCount > 0
              ? 'bg-cyan-600/15 border-cyan-500/50 text-cyan-300 hover:bg-cyan-600/25'
              : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-cyan-500 text-white text-[10px] font-bold flex items-center justify-center">
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
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-2xs font-semibold'
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
