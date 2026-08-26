import React from 'react';
import {
  SearchFilters,
  SearchFacets,
  SearchableEntityType,
  SavedSearch,
  RecentSearch,
} from '@/types/intelligence';
import {
  Filter,
  Bookmark,
  Clock,
  RotateCcw,
  Tag,
  Building,
  Film,
  Layers,
  CheckCircle2,
  Trash2,
} from 'lucide-react';

interface SearchFilterSidebarProps {
  filters: SearchFilters;
  facets: SearchFacets;
  savedSearches: SavedSearch[];
  recentSearches: RecentSearch[];
  onToggleEntityType: (type: SearchableEntityType) => void;
  onToggleProject: (projectCode: string) => void;
  onToggleStatus: (status: string) => void;
  onApplySavedSearch: (saved: SavedSearch) => void;
  onDeleteSavedSearch: (id: string) => void;
  onSelectRecentQuery: (query: string) => void;
  onResetFilters: () => void;
  onOpenSaveModal: () => void;
}

const ENTITY_ICONS: Record<string, string> = {
  project: '🎬',
  shot: '🎯',
  asset: '📦',
  task: '✅',
  version: '🎞️',
  review: '👁️',
  delivery: '🚀',
  knowledge: '📚',
  person: '👤',
  department: '🏢',
  team: '👥',
  vendor: '🤝',
  client: '💼',
  organization: '🏛️',
  office: '📍',
  media: '🖼️',
};

export const SearchFilterSidebar: React.FC<SearchFilterSidebarProps> = ({
  filters,
  facets,
  savedSearches,
  recentSearches,
  onToggleEntityType,
  onToggleProject,
  onToggleStatus,
  onApplySavedSearch,
  onDeleteSavedSearch,
  onSelectRecentQuery,
  onResetFilters,
  onOpenSaveModal,
}) => {
  return (
    <aside className="w-80 border-r border-slate-800/80 bg-slate-950/60 p-4 flex flex-col gap-6 overflow-y-auto shrink-0 select-none">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Filter className="w-4 h-4 text-indigo-400" />
          <span>Search Filters</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            id="btn-save-search-sidebar"
            onClick={onOpenSaveModal}
            className="text-xs px-2.5 py-1 rounded bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 flex items-center gap-1 transition-colors cursor-pointer"
            title="Save current search criteria"
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Save</span>
          </button>
          <button
            id="btn-reset-filters"
            onClick={onResetFilters}
            className="text-xs px-2 py-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded flex items-center gap-1 transition-colors cursor-pointer"
            title="Reset all filters"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Saved Searches Section */}
      {savedSearches.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Bookmark className="w-3.5 h-3.5 text-amber-400" />
              Saved Searches
            </span>
            <span className="text-[10px] text-slate-400 font-mono">{savedSearches.length}</span>
          </div>
          <div className="space-y-1">
            {savedSearches.map((saved) => (
              <div
                key={saved.id}
                className="group flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 text-slate-300 hover:text-white transition-all cursor-pointer"
                onClick={() => onApplySavedSearch(saved)}
              >
                <span className="truncate pr-2 font-medium">{saved.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSavedSearch(saved.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-400 transition-opacity"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Searches */}
      {recentSearches.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            Recent Queries
          </div>
          <div className="flex flex-wrap gap-1.5">
            {recentSearches.slice(0, 5).map((recent) => (
              <button
                key={recent.id}
                onClick={() => onSelectRecentQuery(recent.query)}
                className="text-[11px] px-2 py-0.5 rounded-full bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border border-slate-800/80 transition-colors truncate max-w-full cursor-pointer"
              >
                {recent.query}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Facet: Entity Types (All 16 types) */}
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-indigo-400" />
          Entity Type
        </div>
        <div className="grid grid-cols-2 gap-1.5 max-h-56 overflow-y-auto pr-1">
          {facets.entity_types.map((facet) => {
            const isSelected = filters.entity_types.includes(facet.value as SearchableEntityType);
            const icon = ENTITY_ICONS[facet.value] || '📁';
            return (
              <button
                key={facet.value}
                onClick={() => onToggleEntityType(facet.value as SearchableEntityType)}
                className={`flex items-center justify-between px-2 py-1.5 rounded text-xs border text-left transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-200 font-medium'
                    : 'bg-slate-900/40 border-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className="text-sm">{icon}</span>
                  <span className="truncate">{facet.label}</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono ml-1">{facet.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Facet: Projects */}
      {facets.projects.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Film className="w-3.5 h-3.5 text-emerald-400" />
            Project Scope
          </div>
          <div className="space-y-1">
            {facets.projects.map((proj) => {
              const isSelected = filters.project_codes.includes(proj.value);
              return (
                <button
                  key={proj.value}
                  onClick={() => onToggleProject(proj.value)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-200 font-medium'
                      : 'bg-slate-900/40 border-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <span className="font-mono">{proj.value}</span>
                  <span className="text-[10px] text-slate-400 font-mono">{proj.count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Facet: Status */}
      {facets.statuses.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
            Status
          </div>
          <div className="flex flex-wrap gap-1.5">
            {facets.statuses.map((st) => {
              const isSelected = filters.statuses.includes(st.value);
              return (
                <button
                  key={st.value}
                  onClick={() => onToggleStatus(st.value)}
                  className={`text-xs px-2.5 py-1 rounded-md border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-200'
                      : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {st.label} ({st.count})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Facet: Popular Tags */}
      {facets.tags.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-purple-400" />
            Pipeline Tags
          </div>
          <div className="flex flex-wrap gap-1">
            {facets.tags.map((t) => (
              <span
                key={t.value}
                className="text-[11px] px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800"
              >
                #{t.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
};
