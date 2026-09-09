import { PaginatedResponse } from '@/types/drf';

export function delay(ms = 200): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function paginateDRF<T>(
  items: T[],
  url: URL,
  defaultPageSize = 10
): PaginatedResponse<T> {
  const pageStr = url.searchParams.get('page');
  const pageSizeStr = url.searchParams.get('page_size') || url.searchParams.get('limit');
  const page = Math.max(1, parseInt(pageStr || '1', 10));
  const pageSize = Math.max(1, parseInt(pageSizeStr || String(defaultPageSize), 10));

  const total = items.length;
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const results = items.slice(startIndex, endIndex);

  const totalPages = Math.ceil(total / pageSize);

  const createPageUrl = (targetPage: number) => {
    const nextUrl = new URL(url.toString());
    nextUrl.searchParams.set('page', String(targetPage));
    nextUrl.searchParams.set('page_size', String(pageSize));
    return nextUrl.pathname + nextUrl.search;
  };

  const next = page < totalPages ? createPageUrl(page + 1) : null;
  const previous = page > 1 ? createPageUrl(page - 1) : null;

  return {
    count: total,
    next,
    previous,
    results,
  };
}

export function applyFiltersAndSearch<T extends Record<string, any>>(
  items: T[],
  url: URL,
  searchableFields: (keyof T)[] = []
): T[] {
  let filtered = [...items];

  // Search
  const search = url.searchParams.get('search')?.toLowerCase();
  if (search && searchableFields.length > 0) {
    filtered = filtered.filter((item) =>
      searchableFields.some((field) => {
        const val = item[field];
        return val ? String(val).toLowerCase().includes(search) : false;
      })
    );
  }

  // Exact match filters for recognized query params
  url.searchParams.forEach((value, key) => {
    if (['page', 'page_size', 'limit', 'offset', 'search', 'ordering'].includes(key)) {
      return;
    }
    if (value) {
      filtered = filtered.filter((item) => {
        if (item[key] === undefined) return true;
        return String(item[key]).toLowerCase() === value.toLowerCase();
      });
    }
  });

  // Ordering
  const ordering = url.searchParams.get('ordering');
  if (ordering) {
    const isDesc = ordering.startsWith('-');
    const field = isDesc ? ordering.substring(1) : ordering;

    filtered.sort((a, b) => {
      const valA = a[field];
      const valB = b[field];
      if (valA === valB) return 0;
      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;
      if (valA < valB) return isDesc ? 1 : -1;
      return isDesc ? -1 : 1;
    });
  }

  return filtered;
}
