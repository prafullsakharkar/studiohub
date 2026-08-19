// Reusable Data Table Architecture for Foundation Apps

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Filter, Search, Settings, Download, RefreshCw, Columns, MoreHorizontal, Check, X, ArrowUp, ArrowDown, Trash2, Edit, Eye, Archive, AlertCircle, Plus } from 'lucide-react';
import { Button } from '@/shared/components/Button';
import { Pagination } from '@/shared/components/Pagination';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { EmptyState } from '@/shared/components/EmptyState';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { Modal } from '@/shared/components/Modal';
import { Can } from '@/core/permissions/Can';
import { useFoundationPermissions } from '@/modules/core/hooks/useFoundationPermissions';
import { DEFAULT_PAGE_SIZE, PAGINATION_OPTIONS } from '@/modules/core/constants';
import { cn } from '@/shared/utils/cn';

// Types
export type Column<T> = {
    id: keyof T | string;
    label: string;
    render?: (value: unknown, row: T) => React.ReactNode;
    renderHeader?: () => React.ReactNode;
    width?: string;
    align?: 'left' | 'center' | 'right';
    sortable?: boolean;
    filterable?: boolean;
    hidden?: boolean;
    cellClassName?: string;
    headerClassName?: string;
};

export type SortConfig<T> = {
    key: keyof T | string;
    direction: 'asc' | 'desc';
};

export type FilterConfig = {
    key: string;
    value: string | number | boolean | string[];
    type?: 'text' | 'number' | 'select' | 'multiselect' | 'date' | 'boolean';
    operator?: 'equals' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte' | 'in';
};

export type TableProps<T> = {
    data: T[] | undefined;
    isLoading: boolean;
    error?: Error | null;
    totalCount: number;
    columns: Column<T>[];
    onSortChange?: (key: keyof T | string, direction: 'asc' | 'desc') => void;
    onFilterChange?: (filters: FilterConfig[]) => void;
    onSearch?: (query: string) => void;
    onRowClick?: (row: T) => void;
    onBulkAction?: (selectedIds: string[], action: string) => void;
    onRefresh?: () => void;
    onExport?: () => void;
    renderRowActions?: (row: T) => React.ReactNode;
    renderBulkActions?: (selectedCount: number) => React.ReactNode;
    emptyState?: {
        icon?: React.ReactNode;
        title: string;
        description: string;
        actionLabel?: string;
        onAction?: () => void;
    };
    searchPlaceholder?: string;
    showSearch?: boolean;
    showFilters?: boolean;
    showColumnToggle?: boolean;
    showExport?: boolean;
    showRefresh?: boolean;
    showPagination?: boolean;
    pageSize?: number;
    currentPage?: number;
    onPageChange?: (page: number) => void;
    rowIdKey?: keyof T | string;
    selectable?: boolean;
    selectedRows?: string[];
    onSelectionChange?: (ids: string[]) => void;
    className?: string;
};

// Main DataTable Component
export function DataTable<T extends { id?: string | number }>({
    data,
    isLoading,
    error,
    totalCount,
    columns,
    onSortChange,
    onFilterChange,
    onSearch,
    onRowClick,
    onBulkAction,
    onRefresh,
    onExport,
    renderRowActions,
    renderBulkActions,
    emptyState,
    searchPlaceholder = 'Search...',
    showSearch = true,
    showFilters = true,
    showColumnToggle = true,
    showExport = true,
    showRefresh = true,
    showPagination = true,
    pageSize = DEFAULT_PAGE_SIZE,
    currentPage = 1,
    onPageChange = () => { },
    rowIdKey = 'id',
    selectable = false,
    selectedRows = [],
    onSelectionChange,
    className,
}: TableProps<T>) {
    const [sortConfig, setSortConfig] = useState<SortConfig<T> | null>(null);
    const [filters, setFilters] = useState<FilterConfig[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [isColumnOpen, setIsColumnOpen] = useState(false);
    const [bulkActionModalOpen, setBulkActionModalOpen] = useState(false);
    const [bulkAction, setBulkAction] = useState<string>('');

    // Initialize column visibility from columns
    useEffect(() => {
        const initialVisibility: Record<string, boolean> = {};
        columns.forEach((col) => {
            initialVisibility[col.id as string] = !col.hidden;
        });
        setColumnVisibility(initialVisibility);
    }, [columns]);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Handle sort
    const handleSort = useCallback((key: keyof T | string) => {
        setSortConfig((prev) => {
            if (prev?.key === key) {
                return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { key, direction: 'asc' };
        });
        onSortChange?.(key, 'asc');
    }, [onSortChange]);

    // Handle filter
    const handleFilterChange = useCallback((filter: FilterConfig) => {
        setFilters((prev) => {
            const existingIndex = prev.findIndex((f) => f.key === filter.key);
            if (existingIndex >= 0) {
                const newFilters = [...prev];
                newFilters[existingIndex] = filter;
                return newFilters;
            }
            return [...prev, filter];
        });
        onFilterChange?.([filter]);
    }, [onFilterChange]);

    // Handle search
    const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
        onSearch?.(e.target.value);
    }, [onSearch]);

    // Handle clear search
    const handleClearSearch = useCallback(() => {
        setSearchQuery('');
        setDebouncedSearch('');
        onSearch?.('');
    }, [onSearch]);

    // Handle column toggle
    const toggleColumn = useCallback((columnId: string) => {
        setColumnVisibility((prev) => ({
            ...prev,
            [columnId]: !prev[columnId],
        }));
    }, []);

    // Handle select all
    const handleSelectAll = useCallback(() => {
        if (selectedRows.length === data?.length) {
            onSelectionChange?.([]);
        } else {
            onSelectionChange?.(data?.map((row) => String(row[rowIdKey as keyof T])) || []);
        }
    }, [data, selectedRows.length, onSelectionChange, rowIdKey]);

    // Handle select row
    const handleSelectRow = useCallback((id: string) => {
        if (selectedRows.includes(id)) {
            onSelectionChange?.(selectedRows.filter((rowId) => rowId !== id));
        } else {
            onSelectionChange?.([...selectedRows, id]);
        }
    }, [selectedRows, onSelectionChange]);

    // Handle bulk action
    const handleBulkAction = useCallback((action: string) => {
        setBulkAction(action);
        setBulkActionModalOpen(true);
    }, []);

    // Get sorted and filtered data
    const processedData = useMemo(() => {
        let result = data || [];

        // Apply search filter
        if (debouncedSearch) {
            const searchLower = debouncedSearch.toLowerCase();
            result = result.filter((row) =>
                Object.values(row).some((value) =>
                    String(value).toLowerCase().includes(searchLower)
                )
            );
        }

        // Apply column visibility
        return result;
    }, [data, debouncedSearch]);

    // Get sorted data
    const sortedData = useMemo(() => {
        if (!sortConfig) return processedData;
        return [...processedData].sort((a, b) => {
            const aValue = a[sortConfig.key as keyof T];
            const bValue = b[sortConfig.key as keyof T];

            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [processedData, sortConfig]);

    const visibleColumns = columns.filter((col) => columnVisibility[col.id as string]);
    const totalPages = Math.ceil(totalCount / pageSize);

    return (
        <div className={cn('space-y-4', className)}>
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-slate-900/50 border border-slate-800/50 backdrop-blur-sm">
                {/* Left: Bulk Actions */}
                <div className="flex items-center gap-2">
                    {selectable && selectedRows.length > 0 && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                            <Check className="w-4 h-4 text-indigo-400" />
                            <span className="text-xs font-medium text-indigo-300">
                                {selectedRows.length} selected
                            </span>
                            {renderBulkActions ? (
                                renderBulkActions(selectedRows.length)
                            ) : (
                                <div className="flex items-center gap-1">
                                    <Can permission="users.update">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-xs text-indigo-300 hover:text-indigo-200 hover:bg-indigo-500/20"
                                            onClick={() => handleBulkAction('activate')}
                                        >
                                            Activate
                                        </Button>
                                    </Can>
                                    <Can permission="users.update">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-xs text-indigo-300 hover:text-indigo-200 hover:bg-indigo-500/20"
                                            onClick={() => handleBulkAction('deactivate')}
                                        >
                                            Deactivate
                                        </Button>
                                    </Can>
                                    <Can permission="users.delete">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-xs text-red-300 hover:text-red-200 hover:bg-red-500/20"
                                            onClick={() => handleBulkAction('delete')}
                                        >
                                            Delete
                                        </Button>
                                    </Can>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Center: Search */}
                {showSearch && (
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={handleSearchChange}
                            placeholder={searchPlaceholder}
                            className="w-full pl-10 pr-8 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                        />
                        {searchQuery && (
                            <button
                                onClick={handleClearSearch}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                )}

                {/* Right: Actions */}
                <div className="flex items-center gap-2">
                    {showFilters && (
                        <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                                'text-xs',
                                filters.length > 0 && 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'
                            )}
                            onClick={() => setIsFilterOpen(true)}
                            leftIcon={<Filter className="w-4 h-4" />}
                        >
                            Filters
                            {filters.length > 0 && (
                                <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold bg-indigo-500 text-white rounded-full">
                                    {filters.length}
                                </span>
                            )}
                        </Button>
                    )}

                    {showColumnToggle && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            onClick={() => setIsColumnOpen(true)}
                            leftIcon={<Columns className="w-4 h-4" />}
                        >
                            Columns
                        </Button>
                    )}

                    {showRefresh && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            onClick={onRefresh}
                            leftIcon={<RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />}
                        >
                            Refresh
                        </Button>
                    )}

                    {showExport && (
                        <Can permission="audit.export">
                            <Button
                                variant="outline"
                                size="sm"
                                className="text-xs"
                                onClick={onExport}
                                leftIcon={<Download className="w-4 h-4" />}
                            >
                                Export
                            </Button>
                        </Can>
                    )}

                    <Button
                        variant="primary"
                        size="sm"
                        className="text-xs"
                        onClick={() => { }}
                        leftIcon={<Plus className="w-4 h-4" />}
                    >
                        Create
                    </Button>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/30 backdrop-blur-sm">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-900/50 border-b border-slate-800">
                        <tr>
                            {selectable && (
                                <th className="px-4 py-3 w-10">
                                    <input
                                        type="checkbox"
                                        checked={selectedRows.length === data?.length && data?.length > 0}
                                        onChange={handleSelectAll}
                                        className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-indigo-500 focus:ring-indigo-500/50"
                                    />
                                </th>
                            )}
                            {visibleColumns.map((col) => (
                                <th
                                    key={col.id as string}
                                    className={cn(
                                        'px-4 py-3 font-semibold text-slate-300',
                                        col.align === 'center' && 'text-center',
                                        col.align === 'right' && 'text-right',
                                        col.headerClassName
                                    )}
                                    style={{ width: col.width }}
                                >
                                    <div className="flex items-center gap-2">
                                        {col.renderHeader ? (
                                            col.renderHeader()
                                        ) : (
                                            <span>{col.label}</span>
                                        )}
                                        {col.sortable && (
                                            <button
                                                onClick={() => handleSort(col.id)}
                                                className="text-slate-500 hover:text-slate-300"
                                            >
                                                {sortConfig?.key === col.id ? (
                                                    sortConfig.direction === 'asc' ? (
                                                        <ArrowUp className="w-3 h-3" />
                                                    ) : (
                                                        <ArrowDown className="w-3 h-3" />
                                                    )
                                                ) : (
                                                    <div className="flex flex-col">
                                                        <ArrowUp className="w-3 h-3 opacity-30" />
                                                        <ArrowDown className="w-3 h-3 opacity-30" />
                                                    </div>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </th>
                            ))}
                            {(renderRowActions || selectable) && (
                                <th className="px-4 py-3 w-24 text-right font-semibold text-slate-300">
                                    Actions
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                        {isLoading ? (
                            <tr>
                                <td colSpan={visibleColumns.length + (selectable ? 1 : 0) + (renderRowActions ? 1 : 0)}>
                                    <LoadingSpinner size="lg" label="Loading..." />
                                </td>
                            </tr>
                        ) : error ? (
                            <tr>
                                <td colSpan={visibleColumns.length + (selectable ? 1 : 0) + (renderRowActions ? 1 : 0)}>
                                    <EmptyState
                                        icon={<AlertCircle className="w-8 h-8 text-red-400" />}
                                        title="Error Loading Data"
                                        description={error.message || 'An error occurred while loading data.'}
                                        actionLabel="Retry"
                                        onAction={onRefresh}
                                    />
                                </td>
                            </tr>
                        ) : sortedData.length === 0 ? (
                            <tr>
                                <td colSpan={visibleColumns.length + (selectable ? 1 : 0) + (renderRowActions ? 1 : 0)}>
                                    <EmptyState
                                        icon={emptyState?.icon || <Search className="w-8 h-8 text-slate-500" />}
                                        title={emptyState?.title || 'No Results Found'}
                                        description={emptyState?.description || 'No records match your current filters.'}
                                        actionLabel={emptyState?.actionLabel}
                                        onAction={emptyState?.onAction}
                                    />
                                </td>
                            </tr>
                        ) : (
                            sortedData.map((row) => (
                                <tr
                                    key={String(row[rowIdKey as keyof T])}
                                    onClick={() => onRowClick?.(row)}
                                    className={cn(
                                        'group hover:bg-slate-800/50 transition-colors cursor-pointer',
                                        onRowClick && 'hover:bg-slate-800/50'
                                    )}
                                >
                                    {selectable && (
                                        <td className="px-4 py-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedRows.includes(String(row[rowIdKey as keyof T]))}
                                                onChange={() => handleSelectRow(String(row[rowIdKey as keyof T]))}
                                                className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-indigo-500 focus:ring-indigo-500/50"
                                            />
                                        </td>
                                    )}
                                    {visibleColumns.map((col) => (
                                        <td
                                            key={col.id as string}
                                            className={cn(
                                                'px-4 py-3 text-slate-300',
                                                col.align === 'center' && 'text-center',
                                                col.align === 'right' && 'text-right',
                                                col.cellClassName
                                            )}
                                        >
                                            {col.render ? (
                                                col.render(row[col.id as keyof T], row)
                                            ) : (
                                                String(row[col.id as keyof T])
                                            )}
                                        </td>
                                    ))}
                                    {(renderRowActions || selectable) && (
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {renderRowActions ? (
                                                    renderRowActions(row)
                                                ) : (
                                                    <>
                                                        <Can permission="users.view">
                                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                                <Eye className="w-4 h-4" />
                                                            </Button>
                                                        </Can>
                                                        <Can permission="users.update">
                                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                                <Edit className="w-4 h-4" />
                                                            </Button>
                                                        </Can>
                                                        <Can permission="users.delete">
                                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10">
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </Can>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {showPagination && totalCount > 0 && (
                <Pagination
                    currentPage={currentPage}
                    totalCount={totalCount}
                    pageSize={pageSize}
                    onPageChange={onPageChange}
                />
            )}

            {/* Filter Modal */}
            <Modal
                isOpen={isFilterOpen}
                onClose={() => setIsFilterOpen(false)}
                title="Filters"
                maxWidth="md"
            >
                <div className="space-y-4">
                    <p className="text-sm text-slate-400">Filter by specific criteria</p>
                    {/* Filter form would go here */}
                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="outline" onClick={() => setIsFilterOpen(false)}>
                            Cancel
                        </Button>
                        <Button variant="primary" onClick={() => setIsFilterOpen(false)}>
                            Apply Filters
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Column Toggle Modal */}
            <Modal
                isOpen={isColumnOpen}
                onClose={() => setIsColumnOpen(false)}
                title="Column Visibility"
                maxWidth="md"
            >
                <div className="space-y-3">
                    {columns.map((col) => (
                        <label key={col.id as string} className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                checked={columnVisibility[col.id as string] ?? true}
                                onChange={() => toggleColumn(col.id as string)}
                                className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-indigo-500 focus:ring-indigo-500/50"
                            />
                            <span className="text-sm text-slate-300">{col.label}</span>
                        </label>
                    ))}
                </div>
            </Modal>

            {/* Bulk Action Modal */}
            <Modal
                isOpen={bulkActionModalOpen}
                onClose={() => setBulkActionModalOpen(false)}
                title={`Confirm Bulk Action: ${bulkAction}`}
                maxWidth="md"
            >
                <div className="space-y-4">
                    <p className="text-sm text-slate-300">
                        Are you sure you want to {bulkAction} {selectedRows.length} items?
                    </p>
                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="outline" onClick={() => setBulkActionModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="primary"
                            className="bg-red-600 hover:bg-red-700"
                            onClick={() => {
                                onBulkAction?.(selectedRows, bulkAction);
                                setBulkActionModalOpen(false);
                            }}
                        >
                            Confirm
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

// DataTable Toolbar Component
export function DataTableToolbar({
    title,
    description,
    onRefresh,
    onExport,
    onSearch,
    searchPlaceholder = 'Search...',
    showSearch = true,
    showFilters = true,
    showColumnToggle = true,
    showExport = true,
    showRefresh = true,
    filtersCount = 0,
    onFilterClick,
}: {
    title: string;
    description?: string;
    onRefresh?: () => void;
    onExport?: () => void;
    onSearch?: (query: string) => void;
    searchPlaceholder?: string;
    showSearch?: boolean;
    showFilters?: boolean;
    showColumnToggle?: boolean;
    showExport?: boolean;
    showRefresh?: boolean;
    filtersCount?: number;
    onFilterClick?: () => void;
}) {
    const [searchQuery, setSearchQuery] = useState('');

    const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
        onSearch?.(e.target.value);
    }, [onSearch]);

    const handleClearSearch = useCallback(() => {
        setSearchQuery('');
        onSearch?.('');
    }, [onSearch]);

    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">{title}</h1>
                {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
            </div>

            <div className="flex items-center gap-2">
                {showSearch && (
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={handleSearchChange}
                            placeholder={searchPlaceholder}
                            className="w-64 pl-10 pr-8 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                        />
                        {searchQuery && (
                            <button
                                onClick={handleClearSearch}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                )}

                {showFilters && (
                    <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                            'text-xs',
                            filtersCount > 0 && 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'
                        )}
                        onClick={onFilterClick}
                        leftIcon={<Filter className="w-4 h-4" />}
                    >
                        Filters
                        {filtersCount > 0 && (
                            <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold bg-indigo-500 text-white rounded-full">
                                {filtersCount}
                            </span>
                        )}
                    </Button>
                )}

                {showColumnToggle && (
                    <Button variant="outline" size="sm" className="text-xs" leftIcon={<Columns className="w-4 h-4" />}>
                        Columns
                    </Button>
                )}

                {showRefresh && (
                    <Button variant="outline" size="sm" className="text-xs" onClick={onRefresh} leftIcon={<RefreshCw className="w-4 h-4" />}>
                        Refresh
                    </Button>
                )}

                {showExport && (
                    <Button variant="outline" size="sm" className="text-xs" onClick={onExport} leftIcon={<Download className="w-4 h-4" />}>
                        Export
                    </Button>
                )}
            </div>
        </div>
    );
}

// Filter Builder Component
export function FilterBuilder({
    filters,
    onAddFilter,
    onRemoveFilter,
    onFilterChange,
}: {
    filters: FilterConfig[];
    onAddFilter: () => void;
    onRemoveFilter: (index: number) => void;
    onFilterChange: (index: number, filter: FilterConfig) => void;
}) {
    const filterOptions = [
        { value: 'text', label: 'Text' },
        { value: 'number', label: 'Number' },
        { value: 'select', label: 'Select' },
        { value: 'multiselect', label: 'Multi-Select' },
        { value: 'date', label: 'Date' },
        { value: 'boolean', label: 'Boolean' },
    ];

    const operatorOptions = [
        { value: 'equals', label: 'Equals' },
        { value: 'contains', label: 'Contains' },
        { value: 'gt', label: 'Greater Than' },
        { value: 'lt', label: 'Less Than' },
        { value: 'gte', label: 'Greater or Equal' },
        { value: 'lte', label: 'Less or Equal' },
        { value: 'in', label: 'In' },
    ];

    return (
        <div className="space-y-3">
            {filters.map((filter, index) => (
                <div key={index} className="flex items-center gap-2 p-3 bg-slate-900/50 rounded-lg border border-slate-800">
                    <select
                        value={filter.key}
                        onChange={(e) => onFilterChange(index, { ...filter, key: e.target.value })}
                        className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    >
                        <option value="">Select field...</option>
                        {/* Options would be populated dynamically */}
                    </select>

                    <select
                        value={filter.operator || 'equals'}
                        onChange={(e) => onFilterChange(index, { ...filter, operator: e.target.value as any })}
                        className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    >
                        {operatorOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>

                    <input
                        type="text"
                        value={String(filter.value || '')}
                        onChange={(e) => onFilterChange(index, { ...filter, value: e.target.value })}
                        className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                        placeholder="Value"
                    />

                    <button
                        onClick={() => onRemoveFilter(index)}
                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ))}

            <Button variant="outline" size="sm" onClick={onAddFilter} className="w-full" leftIcon={<Plus className="w-4 h-4" />}>
                Add Filter
            </Button>
        </div>
    );
}
