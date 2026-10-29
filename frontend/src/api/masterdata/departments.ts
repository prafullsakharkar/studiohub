import { apiClient } from '@/api/client/ApiClient';
import type { components } from '@/core/api/generated/openapi';
import { listFetcher } from '@/shared/data/listing';
import { createQueryKeys } from '@/shared/data/queryKeys';

/** `GET /api/v1/departments/` row (OpenAPI `Department`). `software_stack` is a JSON list on the wire. */
export type Department = Omit<components['schemas']['Department'], 'software_stack'> & { software_stack?: string[] };

export type DepartmentType = Department['department_type'];

export const DEPARTMENT_TYPES: ReadonlyArray<{ value: DepartmentType; label: string }> = [
  { value: 'production', label: 'Production' },
  { value: 'creative', label: 'Creative' },
  { value: 'technical', label: 'Technical' },
  { value: 'support', label: 'Support' },
  { value: 'administration', label: 'Administration' },
];

/** Writable fields (`id`, `created_at`, `updated_at` are read-only). */
export type DepartmentInput = Pick<Department, 'code' | 'name' | 'department_type'> &
  Partial<Pick<Department, 'description' | 'parent' | 'manager' | 'color' | 'software_stack'>>;

export const departmentKeys = createQueryKeys('departments');

/** Supported by the backend: filter department_type/parent, search name+code, ordering name/code/created_at. */
export const DEPARTMENT_ORDERING = ['name', 'code', 'created_at'] as const;

const BASE = '/api/v1/departments/';

export const departmentsApi = {
  list: listFetcher<Department>(BASE),
  get: (id: string, signal?: AbortSignal) => apiClient.get<Department>(`${BASE}${id}/`, { signal }),
  create: (input: DepartmentInput) => apiClient.post<Department>(BASE, input),
  update: (id: string, patch: Partial<DepartmentInput>) => apiClient.patch<Department>(`${BASE}${id}/`, patch),
  remove: (id: string) => apiClient.delete<void>(`${BASE}${id}/`),
};
