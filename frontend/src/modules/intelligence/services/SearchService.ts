import { ApiClient } from '@/api/client/ApiClient';
import {
  SearchResultItem,
  SearchFilters,
  SearchFacets,
  SavedSearch,
  RecentSearch,
} from '@/types/intelligence';

class SearchService {
  private api = new ApiClient('/api/v1');

  async search(filters: SearchFilters): Promise<{
    results: SearchResultItem[];
    facets: SearchFacets;
    total: number;
  }> {
    const response = await this.api.post<{
      results: SearchResultItem[];
      facets: SearchFacets;
      total: number;
    }>('/intelligence/search/', filters);
    return response;
  }

  async getSavedSearches(): Promise<SavedSearch[]> {
    const response = await this.api.get<SavedSearch[]>('/intelligence/search/saved/');
    return response;
  }

  async saveSearch(searchData: Omit<SavedSearch, 'id' | 'created_at' | 'updated_at'>): Promise<SavedSearch> {
    const response = await this.api.post<SavedSearch>('/intelligence/search/saved/', searchData);
    return response;
  }

  async deleteSavedSearch(id: string): Promise<void> {
    await this.api.delete(`/intelligence/search/saved/${id}/`);
  }

  async getRecentSearches(): Promise<RecentSearch[]> {
    const response = await this.api.get<RecentSearch[]>('/intelligence/search/recent/');
    return response;
  }

  async addRecentSearch(query: string, filtersSnapshot?: Partial<SearchFilters>): Promise<RecentSearch> {
    const response = await this.api.post<RecentSearch>('/intelligence/search/recent/', {
      query: query.trim(),
      filters_snapshot: filtersSnapshot,
    });
    return response;
  }

  async clearRecentSearches(): Promise<void> {
    await this.api.delete('/intelligence/search/recent/');
  }
}

export const searchService = new SearchService();
