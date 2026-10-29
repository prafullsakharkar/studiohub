import { useState, useEffect, useCallback, useMemo } from 'react';

export interface UsePersistedPaginationOptions {
  /** Unique key identifier to persist pagination state for this view in localStorage */
  storageKey: string;
  /** Default active page when no saved state is found (default: 1) */
  defaultPage?: number;
  /** Default number of items per page when no saved state is found (default: 20) */
  defaultPageSize?: number;
  /** Available page size options */
  pageSizeOptions?: number[];
  /** Whether to persist current page index (default: true) */
  persistPage?: boolean;
  /** Whether to persist results-per-page preference (default: true) */
  persistPageSize?: boolean;
}

export interface PersistedPaginationState {
  page: number;
  pageSize: number;
}

const STORAGE_PREFIX = 'studiohub_pagination_';

function getStoredPagination(
  storageKey: string,
  defaultPage: number,
  defaultPageSize: number
): PersistedPaginationState {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { page: defaultPage, pageSize: defaultPageSize };
  }

  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${storageKey}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      const parsedPage = typeof parsed.page === 'number' && parsed.page > 0 ? Math.floor(parsed.page) : defaultPage;
      const parsedPageSize = typeof parsed.pageSize === 'number' && parsed.pageSize > 0 ? Math.floor(parsed.pageSize) : defaultPageSize;
      return { page: parsedPage, pageSize: parsedPageSize };
    }
  } catch (err) {
    console.warn(`[usePersistedPagination] Failed to load from localStorage for ${storageKey}:`, err);
  }

  return { page: defaultPage, pageSize: defaultPageSize };
}

function saveStoredPagination(
  storageKey: string,
  state: PersistedPaginationState
): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    window.localStorage.setItem(
      `${STORAGE_PREFIX}${storageKey}`,
      JSON.stringify(state)
    );
  } catch (err) {
    console.warn(`[usePersistedPagination] Failed to save to localStorage for ${storageKey}:`, err);
  }
}

export function usePersistedPagination(options: UsePersistedPaginationOptions) {
  const {
    storageKey,
    defaultPage = 1,
    defaultPageSize = 20,
    pageSizeOptions = [10, 20, 50, 100],
    persistPage = true,
    persistPageSize = true,
  } = options;

  // Initialize state from localStorage or defaults
  const [state, setState] = useState<PersistedPaginationState>(() => {
    return getStoredPagination(storageKey, defaultPage, defaultPageSize);
  });

  const page = state.page;
  const pageSize = state.pageSize;

  // Sync to localStorage whenever page or pageSize changes
  useEffect(() => {
    saveStoredPagination(storageKey, {
      page: persistPage ? page : defaultPage,
      pageSize: persistPageSize ? pageSize : defaultPageSize,
    });
  }, [storageKey, page, pageSize, persistPage, persistPageSize, defaultPage, defaultPageSize]);

  // Set page handler
  const setPage = useCallback((newPage: number | ((prev: number) => number)) => {
    setState((prev) => {
      const resolved = typeof newPage === 'function' ? newPage(prev.page) : newPage;
      const validPage = Math.max(1, Math.floor(resolved));
      return { ...prev, page: validPage };
    });
  }, []);

  // Set pageSize handler (also adjusts/clamps current page to avoid blank views)
  const setPageSize = useCallback((newPageSize: number) => {
    setState((prev) => {
      const validSize = Math.max(1, Math.floor(newPageSize));
      return {
        ...prev,
        pageSize: validSize,
        page: 1, // Reset to page 1 on page-size change for optimal UX
      };
    });
  }, []);

  // Reset pagination state
  const resetPagination = useCallback(() => {
    setState({
      page: defaultPage,
      pageSize: defaultPageSize,
    });
  }, [defaultPage, defaultPageSize]);

  // Helper to slice data array directly
  const paginate = useCallback(
    <T>(items: T[]): T[] => {
      const start = (page - 1) * pageSize;
      return items.slice(start, start + pageSize);
    },
    [page, pageSize]
  );

  // Helper to calculate total pages given total count
  const getTotalPages = useCallback(
    (totalCount: number): number => {
      return Math.max(1, Math.ceil(totalCount / pageSize));
    },
    [pageSize]
  );

  return useMemo(
    () => ({
      page,
      pageSize,
      setPage,
      setPageSize,
      resetPagination,
      paginate,
      getTotalPages,
      pageSizeOptions,
    }),
    [page, pageSize, setPage, setPageSize, resetPagination, paginate, getTotalPages, pageSizeOptions]
  );
}
