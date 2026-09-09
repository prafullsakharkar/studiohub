import React, { useState } from 'react';
import { useGlobalSearch } from '../../hooks/useGlobalSearch';
import { SearchFilterSidebar } from './SearchFilterSidebar';
import { SearchResultCard } from './SearchResultCard';
import { SavedSearchModal } from './SavedSearchModal';
import {
  Search,
  X,
  SlidersHorizontal,
  ArrowUpDown,
  Sparkles,
  Layers,
  SearchX,
  CheckCheck,
} from 'lucide-react';

export const GlobalSearchWorkspace: React.FC = () => {
  const {
    filters,
    setFilters,
    setQuery,
    toggleEntityType,
    toggleProject,
    toggleStatus,
    results,
    facets,
    totalCount,
    savedSearches,
    recentSearches,
    loading,
    saveCurrentSearch,
    deleteSaved,
    applySavedSearch,
    resetFilters,
  } = useGlobalSearch();

  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);

  const getQuerySummary = () => {
    const parts = [];
    if (filters.query) parts.push(`Query: "${filters.query}"`);
    if (filters.entity_types.length) parts.push(`Entities: [${filters.entity_types.join(', ')}]`);
    if (filters.project_codes.length) parts.push(`Projects: [${filters.project_codes.join(', ')}]`);
    if (filters.statuses.length) parts.push(`Status: [${filters.statuses.join(', ')}]`);
    return parts.join(' • ');
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Search Bar Header */}
      <header className="p-4 md:px-6 border-b border-slate-800/80 bg-slate-900/40 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-3">
          {/* Main Input */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              id="input-global-search-main"
              type="text"
              value={filters.query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search organizations, clients, vendors, people, projects, shots, assets, tasks, versions, reviews, knowledge..."
              className="w-full pl-11 pr-10 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all shadow-inner"
              autoFocus
            />
            {filters.query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className={`px-3 py-2 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors cursor-pointer ${
                showSidebar
                  ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-200'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filters</span>
            </button>

            {/* Sort Menu */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <select
                id="select-search-sort"
                value={filters.sort_by}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    sort_by: e.target.value as any,
                  }))
                }
                className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="relevance" className="bg-slate-900">Relevance</option>
                <option value="date_desc" className="bg-slate-900">Newest First</option>
                <option value="date_asc" className="bg-slate-900">Oldest First</option>
                <option value="title_asc" className="bg-slate-900">Alphabetical (A-Z)</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Filter Sidebar */}
        {showSidebar && (
          <SearchFilterSidebar
            filters={filters}
            facets={facets}
            savedSearches={savedSearches}
            recentSearches={recentSearches}
            onToggleEntityType={toggleEntityType}
            onToggleProject={toggleProject}
            onToggleStatus={toggleStatus}
            onApplySavedSearch={applySavedSearch}
            onDeleteSavedSearch={deleteSaved}
            onSelectRecentQuery={setQuery}
            onResetFilters={resetFilters}
            onOpenSaveModal={() => setIsSaveModalOpen(true)}
          />
        )}

        {/* Results Stream */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          <div className="max-w-5xl mx-auto space-y-4">
            {/* Meta Bar */}
            <div className="flex items-center justify-between text-xs text-slate-400 pb-1 border-b border-slate-800/60">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-200">
                  {loading ? 'Searching...' : `${totalCount} Results`}
                </span>
                {filters.entity_types.length > 0 && (
                  <span className="text-slate-400">
                    in {filters.entity_types.length} selected entity types
                  </span>
                )}
              </div>

              {filters.query && (
                <div className="text-[11px] text-indigo-400/90 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  <span>Full-Text Scored</span>
                </div>
              )}
            </div>

            {/* Results List */}
            {results.length > 0 ? (
              <div className="space-y-2.5">
                {results.map((item) => (
                  <SearchResultCard key={item.id} item={item} query={filters.query} />
                ))}
              </div>
            ) : (
              <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400">
                  <SearchX className="w-6 h-6 text-slate-400" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-slate-200">No matching entities found</h3>
                  <p className="text-xs text-slate-400 max-w-sm">
                    Try adjusting your keywords, loosening filters, or expanding your project scope.
                  </p>
                </div>
                <button
                  onClick={resetFilters}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 transition-colors cursor-pointer"
                >
                  Reset all filters
                </button>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Save Modal */}
      <SavedSearchModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        onSave={async (name, desc) => {
          await saveCurrentSearch(name, desc);
        }}
        querySummary={getQuerySummary()}
      />
    </div>
  );
};
