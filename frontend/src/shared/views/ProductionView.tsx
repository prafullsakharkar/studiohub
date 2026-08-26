import React, { useState, useMemo } from 'react';
import {
  Download,
  Columns,
  Layers,
  ArrowUpDown,
  SlidersHorizontal,
  RefreshCw,
  Plus,
  Trash2,
  FileSpreadsheet,
  FileJson,
  ClipboardCheck,
  Check,
} from 'lucide-react';
import {
  EntityType,
  FieldDefinition,
  DataViewMode,
  SavedView,
  FilterGroup,
  SortConfig,
  BulkAction,
  EntityAction,
} from '@/types/crud';
import { applyFiltersAndSearch } from '@/shared/filters/filterEvaluator';
import { FilterBuilder } from '@/shared/filters/FilterBuilder';
import { QuickFilterBar } from '@/shared/filters/QuickFilterBar';
import { SavedViewsBar } from './SavedViewsBar';
import { TableView } from './views/TableView';
import { GridView } from './views/GridView';
import { BoardView } from './views/BoardView';
import { TimelineView } from './views/TimelineView';
import { CalendarView } from './views/CalendarView';
import { HierarchyView } from './views/HierarchyView';
import { GalleryView } from './views/GalleryView';
import { Pagination } from '@/shared/components/Pagination';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';

interface ProductionViewProps<T = any> {
  entityType: EntityType;
  data: T[];
  fields: FieldDefinition<T>[];
  initialViewMode?: DataViewMode;
  initialGroupBy?: string;
  bulkActions?: BulkAction<T>[];
  entityActions?: EntityAction<T>[];
  onItemClick?: (item: T) => void;
  onAddNew?: () => void;
  isLoading?: boolean;
  emptyMessage?: string;
  className?: string;
}

export function ProductionView<T extends { id: string }>({
  entityType,
  data,
  fields,
  initialViewMode = 'table',
  initialGroupBy,
  bulkActions = [],
  entityActions = [],
  onItemClick,
  onAddNew,
  isLoading = false,
  emptyMessage,
  className = '',
}: ProductionViewProps<T>) {
  // Master View States
  const [viewMode, setViewMode] = useState<DataViewMode>(initialViewMode);
  const [activeSavedViewId, setActiveSavedViewId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [groupBy, setGroupBy] = useState<string | undefined>(initialGroupBy);

  // Filters State
  const [filterGroup, setFilterGroup] = useState<FilterGroup>({
    id: 'root-filter',
    logicalOperator: 'AND',
    conditions: [],
  });
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // Sorting & Columns State
  const [sortConfig, setSortConfig] = useState<SortConfig[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() =>
    fields.filter((f) => !f.hiddenByDefault).map((f) => f.key)
  );
  const [isColumnDropdownOpen, setIsColumnDropdownOpen] = useState(false);

  // Selection & Pagination
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [copiedNotification, setCopiedNotification] = useState(false);

  // Sort handler
  const handleSortChange = (fieldKey: string) => {
    setSortConfig((prev) => {
      const existing = prev.find((s) => s.field === fieldKey);
      if (!existing) {
        return [{ field: fieldKey, direction: 'asc' }];
      }
      if (existing.direction === 'asc') {
        return [{ field: fieldKey, direction: 'desc' }];
      }
      return [];
    });
  };

  // Saved View Selection handler
  const handleSelectSavedView = (view: SavedView) => {
    setActiveSavedViewId(view.id);
    setViewMode(view.viewMode);
    if (view.groupBy) setGroupBy(view.groupBy);
    if (view.filters) setFilterGroup(view.filters);
    if (view.sort) setSortConfig(view.sort);
    if (view.visibleColumns && view.visibleColumns.length > 0) {
      setVisibleColumns(view.visibleColumns);
    }
  };

  // Toggle selection
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Toggle column visibility
  const handleToggleColumn = (key: string) => {
    setVisibleColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  // Filter and Sort Data pipeline
  const filteredData = useMemo(() => {
    let result = applyFiltersAndSearch(data, searchQuery, filterGroup);

    // Apply Sorting
    if (sortConfig.length > 0) {
      const { field, direction } = sortConfig[0];
      result = [...result].sort((a: any, b: any) => {
        const valA = a[field];
        const valB = b[field];
        if (valA === valB) return 0;
        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;
        if (typeof valA === 'number' && typeof valB === 'number') {
          return direction === 'asc' ? valA - valB : valB - valA;
        }
        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();
        return direction === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
      });
    }

    return result;
  }, [data, searchQuery, filterGroup, sortConfig]);

  // Paginated Data
  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedData = useMemo(() => {
    // Gallery, Timeline, Board, Calendar, Hierarchy display full collection
    if (viewMode !== 'table') return filteredData;
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize, viewMode]);

  const handleToggleSelectAll = () => {
    if (selectedIds.length === paginatedData.length && paginatedData.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedData.map((d) => d.id));
    }
  };

  // Export handlers
  const handleExportCSV = () => {
    if (filteredData.length === 0) return;
    const activeF = fields.filter((f) => visibleColumns.includes(f.key));
    const headers = activeF.map((f) => `"${f.label}"`).join(',');
    const rows = filteredData.map((item: any) =>
      activeF.map((f) => `"${String(item[f.key] ?? '').replace(/"/g, '""')}"`).join(',')
    );
    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${entityType}_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    const jsonStr = JSON.stringify(filteredData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${entityType}_export_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(filteredData, null, 2));
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2000);
  };

  // Groupable fields
  const groupableFields = fields.filter((f) => f.groupable !== false);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 1. Saved Views Bar & View Switcher */}
      <SavedViewsBar
        entityType={entityType}
        activeViewId={activeSavedViewId}
        activeViewMode={viewMode}
        onSelectView={handleSelectSavedView}
        onChangeViewMode={setViewMode}
      />

      {/* 2. Controls Toolbar: Search, Filters, Grouping, Columns, Export, Add New */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <QuickFilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          activeFilterCount={filterGroup.conditions.length}
          onOpenAdvancedFilters={() => setIsFilterModalOpen(true)}
          onResetFilters={() => setFilterGroup({ id: 'root', logicalOperator: 'AND', conditions: [] })}
          className="flex-1"
        />

        <div className="flex items-center gap-2 flex-wrap">
          {/* Group By Selector */}
          <div className="flex items-center gap-1 bg-slate-900 px-2 py-1.5 rounded-lg border border-slate-800 text-xs text-slate-300">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[11px] text-slate-500 font-semibold">Group:</span>
            <select
              value={groupBy || ''}
              onChange={(e) => setGroupBy(e.target.value || undefined)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="" className="bg-slate-900">None</option>
              {groupableFields.map((f) => (
                <option key={f.key} value={f.key} className="bg-slate-900">
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          {/* Column Customizer Toggle */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsColumnDropdownOpen(!isColumnDropdownOpen)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
            >
              <Columns className="w-3.5 h-3.5 text-slate-400" />
              <span>Columns</span>
              <span className="text-[10px] font-mono px-1 rounded bg-slate-800 text-slate-400">
                {visibleColumns.length}/{fields.length}
              </span>
            </button>

            {isColumnDropdownOpen && (
              <div
                className="absolute right-0 top-full mt-1.5 z-50 rounded-xl bg-slate-900 border border-slate-700/80 shadow-2xl p-2 w-52 space-y-1 max-h-64 overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-[11px] font-semibold text-slate-400 px-2 py-1 border-b border-slate-800 flex items-center justify-between">
                  <span>Toggle Columns</span>
                  <button
                    type="button"
                    onClick={() => setVisibleColumns(fields.map((f) => f.key))}
                    className="text-[10px] text-indigo-400 hover:underline"
                  >
                    Select All
                  </button>
                </div>
                {fields.map((f) => {
                  const isVis = visibleColumns.includes(f.key);
                  return (
                    <label
                      key={f.key}
                      className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-800 cursor-pointer text-xs text-slate-300"
                    >
                      <input
                        type="checkbox"
                        checked={isVis}
                        onChange={() => handleToggleColumn(f.key)}
                        className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="truncate">{f.label}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Export Actions Dropdown */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={handleExportCSV}
              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-emerald-400 transition-colors"
              title="Export filtered CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleExportJSON}
              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-indigo-400 transition-colors"
              title="Export filtered JSON"
            >
              <FileJson className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleCopyJSON}
              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-400 transition-colors"
              title="Copy JSON to Clipboard"
            >
              {copiedNotification ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <ClipboardCheck className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {/* Add New Entity Button */}
          {onAddNew && (
            <Button
              variant="primary"
              size="sm"
              onClick={onAddNew}
              className="gap-1.5 text-xs py-2 px-3.5 h-auto shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>Create {entityType}</span>
            </Button>
          )}
        </div>
      </div>

      {/* 3. Bulk Actions Floating Bar (when rows selected) */}
      {selectedIds.length > 0 && (
        <div className="bg-indigo-950/80 border border-indigo-500/50 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-slate-100 shadow-xl animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs bg-indigo-600 px-2 py-0.5 rounded-full text-white">
              {selectedIds.length}
            </span>
            <span className="text-xs font-semibold">
              items selected across {entityType}s
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {bulkActions.map((act) => (
              <Button
                key={act.id}
                variant={act.variant === 'danger' ? 'danger' : 'secondary'}
                size="sm"
                onClick={() => {
                  const selectedItems = data.filter((d) => selectedIds.includes(d.id));
                  act.action(selectedIds, selectedItems);
                }}
                className="gap-1.5 text-xs py-1 px-3 h-auto"
              >
                {act.icon}
                <span>{act.label}</span>
              </Button>
            ))}

            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="text-xs text-indigo-300 hover:text-white px-2 py-1 transition-colors"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* 4. Active Data View Rendering */}
      <div>
        {viewMode === 'table' && (
          <TableView
            data={paginatedData}
            fields={fields}
            visibleColumns={visibleColumns}
            sortConfig={sortConfig}
            onSortChange={handleSortChange}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
            groupBy={groupBy}
            actions={entityActions}
            onRowClick={onItemClick}
            isLoading={isLoading}
            emptyMessage={emptyMessage}
          />
        )}

        {viewMode === 'grid' && (
          <GridView
            data={paginatedData}
            fields={fields}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            actions={entityActions}
            onCardClick={onItemClick}
            emptyMessage={emptyMessage}
          />
        )}

        {viewMode === 'board' && (
          <BoardView
            data={filteredData}
            groupBy={groupBy || 'status'}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            actions={entityActions}
            onCardClick={onItemClick}
            emptyMessage={emptyMessage}
          />
        )}

        {viewMode === 'timeline' && (
          <TimelineView
            data={filteredData}
            onItemClick={onItemClick}
            emptyMessage={emptyMessage}
          />
        )}

        {viewMode === 'calendar' && (
          <CalendarView
            data={filteredData}
            onItemClick={onItemClick}
            emptyMessage={emptyMessage}
          />
        )}

        {viewMode === 'hierarchy' && (
          <HierarchyView
            data={filteredData}
            groupBy={groupBy || 'project_code'}
            onItemClick={onItemClick}
            emptyMessage={emptyMessage}
          />
        )}

        {viewMode === 'gallery' && (
          <GalleryView
            data={filteredData}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onItemClick={onItemClick}
            emptyMessage={emptyMessage}
          />
        )}
      </div>

      {/* 5. Table Pagination Bar (Table mode only) */}
      {viewMode === 'table' && totalItems > pageSize && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-slate-400 font-mono">
            Showing {(currentPage - 1) * pageSize + 1}–
            {Math.min(currentPage * pageSize, totalItems)} of {totalItems} items
          </span>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {/* 6. Advanced Filter Builder Modal */}
      <Modal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        title="Advanced Filter Builder"
        size="2xl"
      >
        <FilterBuilder
          fields={fields}
          value={filterGroup}
          onChange={setFilterGroup}
          onApply={() => setIsFilterModalOpen(false)}
          onReset={() => {
            setFilterGroup({ id: 'root', logicalOperator: 'AND', conditions: [] });
            setIsFilterModalOpen(false);
          }}
        />
      </Modal>
    </div>
  );
}
