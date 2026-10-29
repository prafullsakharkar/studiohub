import { apiClient } from '@/api/client/ApiClient';
import { Person } from '@/types/masterData';
import { ListResult, PaginatedResponse } from '@/types/common';

/**
 * People directory (flat `/api/v1/people/` endpoints).
 *
 * Formerly part of the deleted org module's API client; the org dimension
 * is gone, so these calls always target the flat routes and no longer
 * accept an organization id.
 */
export const personApi = {
  getPeople: async (params?: Record<string, any>): Promise<ListResult<Person>> => {
    const res = await apiClient.get<Person[] | PaginatedResponse<Person>>('/api/v1/people/', { params });
    const items = (Array.isArray(res) ? res : res?.results ?? []).map((t: any) => ({
      ...t,
      id: t.id ?? t.uuid,
    }));
    return { items, totalCount: Array.isArray(res) ? null : (res?.count ?? null) };
  },
  getPersonDetail: async (id: string): Promise<Person> => {
    return apiClient.get<Person>(`/api/v1/people/${id}/`);
  },
  createPerson: async (person: Partial<Person>): Promise<Person> => {
    return apiClient.post<Person>('/api/v1/people/', person);
  },
  updatePerson: async (id: string, person: Partial<Person>): Promise<Person> => {
    return apiClient.patch<Person>(`/api/v1/people/${id}/`, person);
  },
  deletePerson: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/api/v1/people/${id}/`);
  },
};
