import React, { useState, useMemo } from 'react';
import { FieldDefinition, SortConfig, EntityAction } from '@/types/crud';
import { TableView } from '@/shared/views/views/TableView';
import { Pagination } from '@/shared/components/Pagination';
import { Columns, Search, RefreshCw } from 'lucide-react';

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
  isLoading?: boolean;
  emptyMessage?: string;
  className?: string;
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
  pageSize = 25,
  isLoading = false,
  emptyMessage = 'No records found.',
  className = '',
}: EntityTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() =>
    fields.filter((f) => !f.hiddenByDefault).map((f) => f.key)
  );
  const [currentPage, setCurrentPage] = useState(1);

  const handleSortChange = (fieldKey: string) => {
    setSortConfig((prev) => {
      const existing = prev.find((s) => s.field === fieldKey);
      if (!existing) return [{ field: fieldKey, direction: 'asc' }];
      if (existing.direction === 'asc') return [{ field: fieldKey, direction: 'desc' }];
      return [];
    });
  };

  const filteredAndSorted = useMemo(() => {
    let result = data;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((item: any) =>
        Object.values(item).some((v) => String(v).toLowerCase().includes(q))
      );
    }
    if (sortConfig.length > 0) {
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
  }, [data, searchQuery, sortConfig]);

  const totalPages = Math.ceil(filteredAndSorted.length / pageSize) || 1;
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSorted.slice(start, start + pageSize);
  }, [filteredAndSorted, currentPage, pageSize]);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Search and Column Filter Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search records..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="text-xs text-slate-400 font-mono">
          {filteredAndSorted.length} items
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
      {filteredAndSorted.length > pageSize && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-slate-400 font-mono">
            Page {currentPage} of {totalPages}
          </span>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      )}
    </div>
  );
}
