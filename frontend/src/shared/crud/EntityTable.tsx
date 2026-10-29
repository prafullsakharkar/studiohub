import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { FieldDefinition, SortConfig, EntityAction } from '@/types/common';
import { TableView } from '@/shared/views/views/TableView';
import { Pagination } from '@/shared/components/Pagination';
import { Columns, RefreshCw } from 'lucide-react';
import { SearchInput } from '@/shared/components/SearchInput';
import { usePersistedPagination } from '@/shared/hooks/usePersistedPagination';

interface EntityTableProps<T = any> {
  data: T[];
  fields: FieldDefinition<T>[];
  actions?: EntityAction<T>[];
  onRowClick?: (item: T) => void;
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: () => void;
  groupBy?: string;
  pageSize?: number;
  pageSizeOptions?: number[];
  storageKey?: string;
  isLoading?: boolean;
  emptyMessage?: string;
  className?: string;
  /**
   * Controlled (server-side) pagination. When `page`, `totalCount` and
   * `onPageChange` are provided, `data` is treated as the already-paginated
   * current server page: no local slicing/search, and pagination is delegated
   * to the parent.
   */
  page?: number;
  totalCount?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  /**
   * Server-side search (controlled mode). When `onSearchChange` is provided,
   * a search input is rendered that delegates to the parent instead of
   * filtering locally.
   */
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  searchPlaceholder?: string;
  onSortChange?: (sort: SortConfig[]) => void;
}

export function EntityTable<T extends { id: string }>({
  data,
  fields,
  actions = [],
  onRowClick,
  selectedIds = [],
  onToggleSelect = () => {},
  onToggleSelectAll = () => {},
  groupBy,
  pageSize: propPageSize = 25,
  pageSizeOptions = [10, 25, 50, 100],
  storageKey = 'entity_table',
  isLoading = false,
  emptyMessage = 'No records found.',
  className = '',
  page,
  totalCount,
  onPageChange,
  onPageSizeChange,
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Search records...',
  onSortChange,
}: EntityTableProps<T>) {
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  // Controlled (server) search is debounced so every keystroke doesn't
  // fire a request; the input stays responsive while the query settles.
  const [pendingSearchQuery, setPendingSearchQuery] = useState(searchQuery ?? '');
  const onSearchChangeRef = useRef(onSearchChange);
  onSearchChangeRef.current = onSearchChange;
  useEffect(() => {
    if (!onSearchChange) return;
    if ((searchQuery ?? '') !== pendingSearchQuery) setPendingSearchQuery(searchQuery ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);
  useEffect(() => {
    if (!onSearchChange) return;
    if (pendingSearchQuery === (searchQuery ?? '')) return;
    const timer = setTimeout(() => onSearchChangeRef.current?.(pendingSearchQuery), 300);
    return () => clearTimeout(timer);
  }, [pendingSearchQuery, searchQuery, onSearchChange]);
  const [sortConfig, setSortConfig] = useState<SortConfig[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() =>
    fields.filter((f) => !f.hiddenByDefault).map((f) => f.key)
  );

  const {
    page: currentPage,
    setPage: setCurrentPage,
    pageSize,
    setPageSize,
  } = usePersistedPagination({
    storageKey,
    defaultPage: 1,
    defaultPageSize: propPageSize,
    pageSizeOptions,
  });

  const handleSortChange = (fieldKey: string) => {
    const next = (() => {
      const existing = sortConfig.find((s) => s.field === fieldKey);
      if (!existing) return [{ field: fieldKey, direction: 'asc' } as const];
      if (existing.direction === 'asc') return [{ field: fieldKey, direction: 'desc' } as const];
      return [];
    })();
    setSortConfig(next);
    onSortChange?.(next);
  };

  const isControlled =
    typeof page === 'number' && typeof totalCount === 'number' && typeof onPageChange === 'function';

  const effectiveSearchQuery = onSearchChange ? (searchQuery ?? '') : localSearchQuery;

  const filteredAndSorted = useMemo(() => {
    let result = data;
    if (!isControlled && effectiveSearchQuery.trim()) {
      const q = effectiveSearchQuery.toLowerCase();
      result = result.filter((item: any) =>
        Object.values(item).some((v) => String(v).toLowerCase().includes(q))
      );
    }
    if (!onSortChange && sortConfig.length > 0) {
      const { field, direction } = sortConfig[0];
      result = [...result].sort((a: any, b: any) => {
        const valA = a[field];
        const valB = b[field];
        if (valA === valB) return 0;
        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;
        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();
        return direction === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
      });
    }
    return result;
  }, [data, effectiveSearchQuery, sortConfig, isControlled]);

  const effectivePage = isControlled ? (page as number) : currentPage;
  const effectivePageSize = isControlled ? propPageSize : pageSize;

  const totalPages = Math.ceil(filteredAndSorted.length / effectivePageSize) || 1;
  const paginated = useMemo(() => {
    if (isControlled) return filteredAndSorted;
    const start = (effectivePage - 1) * effectivePageSize;
    return filteredAndSorted.slice(start, start + effectivePageSize);
  }, [filteredAndSorted, effectivePage, effectivePageSize, isControlled]);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Search and Column Filter Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 max-w-sm">
          {(!isControlled || onSearchChange) && (
            <SearchInput
              value={isControlled ? pendingSearchQuery : localSearchQuery}
              onChange={(e) =>
                onSearchChange ? setPendingSearchQuery(e.target.value) : setLocalSearchQuery(e.target.value)
              }
              onClear={() => (onSearchChange ? setPendingSearchQuery('') : setLocalSearchQuery(''))}
              placeholder={searchPlaceholder}
              className="w-full"
            />
          )}
        </div>

        <div className="text-xs text-slate-400 font-mono">
          {isControlled ? (totalCount as number) : filteredAndSorted.length} items
        </div>
      </div>

      {/* Main Table */}
      <TableView
        data={paginated}
        fields={fields}
        visibleColumns={visibleColumns}
        sortConfig={sortConfig}
        onSortChange={handleSortChange}
        selectedIds={selectedIds}
        onToggleSelect={onToggleSelect}
        onToggleSelectAll={onToggleSelectAll}
        groupBy={groupBy}
        actions={actions}
        onRowClick={onRowClick}
        isLoading={isLoading}
        emptyMessage={emptyMessage}
      />

      {/* Pagination */}
      {(isControlled ? (totalCount as number) > effectivePageSize : filteredAndSorted.length > pageSize) && (
        <Pagination
          currentPage={effectivePage}
          totalCount={isControlled ? (totalCount as number) : filteredAndSorted.length}
          pageSize={effectivePageSize}
          totalPages={isControlled ? Math.max(1, Math.ceil((totalCount as number) / effectivePageSize)) : totalPages}
          pageSizeOptions={pageSizeOptions}
          onPageSizeChange={isControlled && onPageSizeChange ? onPageSizeChange : setPageSize}
          onPageChange={isControlled && onPageChange ? onPageChange : setCurrentPage}
          className="rounded-xl border border-slate-800 bg-slate-900/90 mt-2"
        />
      )}
    </div>
  );
}
