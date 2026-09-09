import {
  SearchResultItem,
  SearchFilters,
  SearchFacets,
  SavedSearch,
  RecentSearch,
  SearchableEntityType,
} from '@/types/intelligence';
import {
  buildGlobalSearchIndex,
  mockSavedSearches,
  mockRecentSearches,
} from '@/mocks/db/intelligence/search';

class SearchService {
  private index: SearchResultItem[] = buildGlobalSearchIndex();
  private savedSearches: SavedSearch[] = [...mockSavedSearches];
  private recentSearches: RecentSearch[] = [...mockRecentSearches];

  async search(filters: SearchFilters): Promise<{
    results: SearchResultItem[];
    facets: SearchFacets;
    total: number;
  }> {
    // Artificial small delay for snappy feel
    await new Promise((r) => setTimeout(r, 60));

    const q = (filters.query || '').trim().toLowerCase();
    const words = q.split(/\s+/).filter(Boolean);

    // Filter index
    let matched = this.index.filter((item) => {
      // 1. Entity type filter
      if (filters.entity_types.length > 0 && !filters.entity_types.includes(item.entity_type)) {
        return false;
      }

      // 2. Project code filter
      if (
        filters.project_codes.length > 0 &&
        item.project_code &&
        item.project_code !== 'ALL' &&
        !filters.project_codes.includes(item.project_code)
      ) {
        return false;
      }

      // 3. Organization filter
      if (
        filters.organization_ids.length > 0 &&
        item.organization_name &&
        !filters.organization_ids.includes(item.organization_name)
      ) {
        return false;
      }

      // 4. Status filter
      if (filters.statuses.length > 0 && item.status && !filters.statuses.includes(item.status)) {
        return false;
      }

      // 5. Full text query matching
      if (words.length > 0) {
        const itemText = [
          item.title,
          item.subtitle || '',
          item.description || '',
          item.project_code || '',
          item.status || '',
          ...(item.tags || []),
        ]
          .join(' ')
          .toLowerCase();

        const matchAll = words.every((w) => itemText.includes(w));
        if (!matchAll) return false;
      }

      return true;
    });

    // Score & Sort
    matched = matched.map((item) => {
      let score = item.score || 1.0;
      if (q) {
        const titleLower = item.title.toLowerCase();
        if (titleLower === q) score += 10;
        else if (titleLower.startsWith(q)) score += 5;
        else if (titleLower.includes(q)) score += 3;
      }
      return { ...item, score };
    });

    if (filters.sort_by === 'relevance') {
      matched.sort((a, b) => b.score - a.score);
    } else if (filters.sort_by === 'date_desc') {
      matched.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    } else if (filters.sort_by === 'date_asc') {
      matched.sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime());
    } else if (filters.sort_by === 'title_asc') {
      matched.sort((a, b) => a.title.localeCompare(b.title));
    }

    // Build Dynamic Facets
    const facets: SearchFacets = {
      entity_types: this.calculateFacetCounts(this.index, 'entity_type'),
      projects: this.calculateFacetCounts(this.index, 'project_code'),
      organizations: this.calculateFacetCounts(this.index, 'organization_name'),
      departments: [
        { value: 'Compositing', label: 'Compositing', count: 14 },
        { value: 'FX Simulation', label: 'FX Simulation', count: 12 },
        { value: 'Character Animation', label: 'Animation', count: 9 },
        { value: 'Lighting & LookDev', label: 'Lighting', count: 8 },
        { value: 'Pipeline & Tooling', label: 'Pipeline', count: 6 },
      ],
      statuses: this.calculateFacetCounts(this.index, 'status'),
      tags: [
        { value: 'USD', label: 'OpenUSD', count: 8 },
        { value: 'ACEScg', label: 'ACEScg', count: 12 },
        { value: 'Dailies', label: 'Dailies', count: 10 },
        { value: 'Aspera', label: 'Aspera', count: 5 },
        { value: 'Hero', label: 'Hero Asset', count: 7 },
      ],
    };

    return {
      results: matched,
      facets,
      total: matched.length,
    };
  }

  private calculateFacetCounts(items: SearchResultItem[], key: keyof SearchResultItem) {
    const counts: Record<string, number> = {};
    items.forEach((item) => {
      const val = item[key];
      if (val && typeof val === 'string' && val !== 'ALL') {
        counts[val] = (counts[val] || 0) + 1;
      }
    });

    return Object.entries(counts)
      .map(([value, count]) => ({
        value,
        label: value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' '),
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }

  async getSavedSearches(): Promise<SavedSearch[]> {
    return [...this.savedSearches];
  }

  async saveSearch(searchData: Omit<SavedSearch, 'id' | 'created_at' | 'updated_at'>): Promise<SavedSearch> {
    const newSearch: SavedSearch = {
      ...searchData,
      id: `save-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.savedSearches.unshift(newSearch);
    return newSearch;
  }

  async deleteSavedSearch(id: string): Promise<void> {
    this.savedSearches = this.savedSearches.filter((s) => s.id !== id);
  }

  async getRecentSearches(): Promise<RecentSearch[]> {
    return [...this.recentSearches];
  }

  async addRecentSearch(query: string, filtersSnapshot?: Partial<SearchFilters>): Promise<RecentSearch> {
    if (!query.trim()) return this.recentSearches[0];
    const existingIndex = this.recentSearches.findIndex((r) => r.query.toLowerCase() === query.toLowerCase());
    if (existingIndex >= 0) {
      this.recentSearches.splice(existingIndex, 1);
    }
    const item: RecentSearch = {
      id: `rec-${Date.now()}`,
      query: query.trim(),
      timestamp: new Date().toISOString(),
      filters_snapshot: filtersSnapshot,
    };
    this.recentSearches.unshift(item);
    if (this.recentSearches.length > 8) {
      this.recentSearches.pop();
    }
    return item;
  }

  async clearRecentSearches(): Promise<void> {
    this.recentSearches = [];
  }
}

export const searchService = new SearchService();
