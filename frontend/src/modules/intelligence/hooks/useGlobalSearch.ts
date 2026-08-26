import { useState, useEffect, useCallback } from 'react';
import {
  SearchResultItem,
  SearchFilters,
  SearchFacets,
  SavedSearch,
  RecentSearch,
  SearchableEntityType,
} from '@/types/intelligence';
import { searchService } from '../services/SearchService';

const defaultFilters: SearchFilters = {
  query: '',
  entity_types: [],
  project_codes: [],
  organization_ids: [],
  departments: [],
  statuses: [],
  tags: [],
  date_range: 'all',
  sort_by: 'relevance',
};

export function useGlobalSearch(initialFilters?: Partial<SearchFilters>) {
  const [filters, setFilters] = useState<SearchFilters>({
    ...defaultFilters,
    ...initialFilters,
  });

  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [facets, setFacets] = useState<SearchFacets>({
    entity_types: [],
    projects: [],
    organizations: [],
    departments: [],
    statuses: [],
    tags: [],
  });
  const [totalCount, setTotalCount] = useState(0);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchResults = useCallback(async (activeFilters: SearchFilters) => {
    setLoading(true);
    try {
      const data = await searchService.search(activeFilters);
      setResults(data.results);
      setFacets(data.facets);
      setTotalCount(data.total);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSavedAndRecent = useCallback(async () => {
    try {
      const [saved, recent] = await Promise.all([
        searchService.getSavedSearches(),
        searchService.getRecentSearches(),
      ]);
      setSavedSearches(saved);
      setRecentSearches(recent);
    } catch (err) {
      console.error('Failed to load saved/recent searches:', err);
    }
  }, []);

  useEffect(() => {
    fetchSavedAndRecent();
  }, [fetchSavedAndRecent]);

  useEffect(() => {
    fetchResults(filters);
  }, [filters, fetchResults]);

  const setQuery = (query: string) => {
    setFilters((prev) => ({ ...prev, query }));
    if (query.trim()) {
      searchService.addRecentSearch(query, filters).then(() => {
        searchService.getRecentSearches().then(setRecentSearches);
      });
    }
  };

  const toggleEntityType = (type: SearchableEntityType) => {
    setFilters((prev) => {
      const exists = prev.entity_types.includes(type);
      const updated = exists
        ? prev.entity_types.filter((t) => t !== type)
        : [...prev.entity_types, type];
      return { ...prev, entity_types: updated };
    });
  };

  const toggleProject = (projectCode: string) => {
    setFilters((prev) => {
      const exists = prev.project_codes.includes(projectCode);
      const updated = exists
        ? prev.project_codes.filter((p) => p !== projectCode)
        : [...prev.project_codes, projectCode];
      return { ...prev, project_codes: updated };
    });
  };

  const toggleStatus = (status: string) => {
    setFilters((prev) => {
      const exists = prev.statuses.includes(status);
      const updated = exists
        ? prev.statuses.filter((s) => s !== status)
        : [...prev.statuses, status];
      return { ...prev, statuses: updated };
    });
  };

  const saveCurrentSearch = async (name: string, description?: string) => {
    const newSaved = await searchService.saveSearch({
      name,
      description,
      filters,
      user_id: 'usr-001',
      is_favorite: false,
    });
    setSavedSearches((prev) => [newSaved, ...prev]);
    return newSaved;
  };

  const deleteSaved = async (id: string) => {
    await searchService.deleteSavedSearch(id);
    setSavedSearches((prev) => prev.filter((s) => s.id !== id));
  };

  const applySavedSearch = (saved: SavedSearch) => {
    setFilters({ ...saved.filters });
  };

  const resetFilters = () => {
    setFilters(defaultFilters);
  };

  return {
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
  };
}
