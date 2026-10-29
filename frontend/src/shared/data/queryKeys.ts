/**
 * Query-key factory: one place per resource, hierarchical so a mutation can invalidate
 * `lists()` (every page/filter combination) without touching unrelated resources.
 *
 *   const departmentKeys = createQueryKeys('departments');
 *   departmentKeys.list({ page: 2 })  // ['departments', 'list', { page: 2 }]
 *   departmentKeys.lists()            // ['departments', 'list']
 */
export function createQueryKeys<P extends string>(resource: P) {
  return {
    all: [resource] as const,
    lists: () => [resource, 'list'] as const,
    list: (params?: Record<string, unknown>) => [resource, 'list', params ?? {}] as const,
    details: () => [resource, 'detail'] as const,
    detail: (id: string) => [resource, 'detail', id] as const,
  };
}
