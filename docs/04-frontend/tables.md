# Tables

List views (shots, tasks, versions, departments, users) use **Material React Table (MRT)** — already in `package.json` — rather than raw TanStack Table. MRT wraps TanStack Table and adds MUI-styled toolbar, column pinning/resizing, density toggle, and row-selection UI out of the box, which matches the MUI-based design system rather than requiring hand-built chrome.

Server drives pagination/sorting/filtering — the same principle as before, just via MRT's `manual*` props instead of raw TanStack Table state:

## Basic Setup

```tsx
// src/modules/production/components/ShotsTable.tsx
import { MaterialReactTable, useMaterialReactTable, type MRT_ColumnDef } from "material-react-table";
import { useUrlState } from "@/shared/hooks/useUrlState";
import { useShots } from "../hooks/useShots";

const columns: MRT_ColumnDef<Shot>[] = [
  { accessorKey: "code", header: "Shot" },
  { accessorKey: "sequence.name", header: "Sequence" },
  { accessorKey: "status", header: "Status", Cell: ({ cell }) => <StatusChip status={cell.getValue<ShotStatus>()} /> },
  { accessorKey: "assignee.name", header: "Assignee" },
  { accessorKey: "dueDate", header: "Due", Cell: ({ cell }) => formatDate(cell.getValue<string>()) },
];

export function ShotsTable() {
  const [tableState, setTableState] = useUrlState<ShotTableState>({
    pagination: { pageIndex: 0, pageSize: 25 },
    sorting: [],
    columnFilters: [],
    globalFilter: "",
  });

  const { data, isLoading, isFetching } = useShots(toApiFilters(tableState));

  const table = useMaterialReactTable({
    columns,
    data: data?.results ?? [],
    rowCount: data?.count ?? 0,
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    state: {
      pagination: tableState.pagination,
      sorting: tableState.sorting,
      columnFilters: tableState.columnFilters,
      globalFilter: tableState.globalFilter,
      isLoading,
      showProgressBars: isFetching,
    },
    onPaginationChange: (updater) => setTableState((s) => ({ ...s, pagination: resolve(updater, s.pagination) })),
    onSortingChange: (updater) => setTableState((s) => ({ ...s, sorting: resolve(updater, s.sorting) })),
    onColumnFiltersChange: (updater) => setTableState((s) => ({ ...s, columnFilters: resolve(updater, s.columnFilters) })),
    onGlobalFilterChange: (value) => setTableState((s) => ({ ...s, globalFilter: value })),
    enableRowSelection: true,
    renderTopToolbarCustomActions: () => <ShotsBulkActions />,
  });

  return <MaterialReactTable table={table} />;
}
```

## URL-Synced State

As before, table state (page, sort, filters, search) lives in the URL via `useUrlState`, so views survive refresh and are shareable/bookmarkable — this hasn't changed with the MRT swap, only the shape of the state objects (MRT uses TanStack Table's native `PaginationState`/`SortingState`/`ColumnFiltersState` types directly).

## Mapping MRT State → DRF Query Params

```ts
function toApiFilters(state: ShotTableState): ShotFilters {
  return {
    page: state.pagination.pageIndex + 1, // DRF pagination is 1-indexed
    page_size: state.pagination.pageSize,
    ordering: state.sorting.map((s) => (s.desc ? `-${s.id}` : s.id)).join(","),
    search: state.globalFilter || undefined,
    ...columnFiltersToParams(state.columnFilters), // maps to 05-api/filtering.md conventions
  };
}
```

## Row Actions & Permissions

Row-level actions (edit, delete, reassign) are rendered conditionally based on `RequirePermission`-style checks (`authentication.md`) — e.g. a "Delete" row action only renders if the user has `production.delete_shot`. This is a UX affordance only; the backend enforces the real check regardless.

```tsx
{
  id: "actions",
  Cell: ({ row }) => (
    <>
      {hasPermission("production.change_shot") && <EditShotButton shot={row.original} />}
      {hasPermission("production.delete_shot") && <DeleteShotButton shot={row.original} />}
    </>
  ),
}
```

## Export

`papaparse` (already in `package.json`) powers CSV export, using the table's **current filter/sort/search state** — export always matches what's visibly on screen, via `renderTopToolbarCustomActions`.

## Bulk Actions

MRT's built-in row selection drives a `<BulkActionsBar>` that appears when `table.getSelectedRowModel().rows.length > 0`, calling module-specific bulk-mutation endpoints (e.g. bulk status update for a batch of shots during a review pass).

## Loading & Empty States

- MRT's `showProgressBars` state (linear progress in the toolbar) is used for background refetches (page/sort/filter changes), while `data?.results` stays populated via React Query's `keepPreviousData`, avoiding layout jank.
- A dedicated per-module empty-state (`EmptyShots`, `EmptyDepartments`) distinguishes "no data yet in this project" from "no results for this filter" — this matters more here than in a typical CRUD app, since an empty shot list at the start of a project is a normal state, not an error.

## Large Datasets

Given production tracking can involve thousands of shots/tasks per project, server-side pagination is non-negotiable (never `manualPagination: false` for these views). For any view genuinely needing to render very large row counts client-side (e.g. an "all shots, all statuses" export preview), fall back to `react-window` (already in `package.json`) for virtualization rather than asking MRT to render everything at once.
