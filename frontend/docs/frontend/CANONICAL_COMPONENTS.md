# Canonical Components Registry

> The shared UI and data pieces of the StudioHub frontend, and where each one lives.
> **Rule: one implementation per pattern. Reuse it; do not write a module-local copy.**
>
> Every path below was checked against the file tree (`src/`). An earlier version of this file described a `src/components/index.ts` barrel and directories (`components/data`, `components/workspace`, `components/entity`, `components/navigation`) that were never built or have been removed; 40 of its 54 paths did not exist. There is **no barrel**: import from the file that owns the component. If you add a shared piece, add a row here.

## Where things belong

| Directory | Owns | Must not contain |
|---|---|---|
| `components/ui`, `components/forms`, `components/history`, `components/system` | Pieces used by more than one module | Domain rules, routes |
| `shared/components` | Visual primitives and shared screens' parts (Button, Modal, Pagination, bulk screens, tabs) | Data fetching for a particular record |
| `shared/workspace/canonical` | The chrome of a record workspace (header, action bar, overflow menu, shell) | Business rules |
| `shared/data`, `shared/forms`, `shared/hooks` | List fetching, server-error forms, small hooks | Components |
| `modules/directory` | The list, form and workspace machinery for records that are *configs* | Anything specific to one record type (that goes in `entities/`) |
| `core/permissions` | `useCan`, the permission map, the route registry, gating components | UI beyond the gates |
| `layouts` | The application shell | Page content |

Domain behaviour stays in `src/modules/<module>/`.

## Visual primitives

| Component | Source | Notes |
|---|---|---|
| `Button` | `shared/components/Button` | primary / secondary / outline / ghost / danger |
| `Badge`, `StatusBadge` | `shared/components/Badge`, `shared/components/StatusBadge` | production status and priority mapping |
| `Card` | `shared/components/Card` | |
| `SearchInput` | `shared/components/SearchInput` | debounced |
| `Pagination` | `shared/components/Pagination` | DRF-style controls |
| `Dialog` | `components/ui/Dialog` | focus trap, ESC, overlay |
| `Modal` | `shared/components/Modal` | the simple modal most screens use |
| `SmartImg` | `components/ui/SmartImg` | image with a fallback |
| `EmptyState`, `LoadingSpinner` | `shared/components/EmptyState`, `shared/components/LoadingSpinner` | |
| `ScrollableTabs` | `shared/components/tabs/ScrollableTabs` | |
| `CommandPalette`, `KeyboardShortcutsModal`, `CoachMarkOverlay` | `shared/components/` | app-level overlays |
| `ToastContainer` | `shared/components/ToastContainer` | shown by `notify` (`core/notifications/notify`) |

## System states and feedback

| Component | Source | Notes |
|---|---|---|
| `QueryBoundary` | `components/system/QueryBoundary` | loading, error and empty states for a query |
| `ApiErrorState` | `components/system/ApiErrorState` | an error from `normalizeApiError`, with the request id |
| `ConfirmDialog` | `components/system/ConfirmDialog` | |
| `GlobalApiStatus` | `components/system/GlobalApiStatus` | |
| `notify` | `core/notifications/notify` | `notify.success`, `notify.fromError(error)` |

## Forms

| Piece | Source | Notes |
|---|---|---|
| `useServerForm` | `shared/forms/useServerForm` | a `useForm` that puts a 400's field errors on the inputs and the rest in a banner |
| `serverErrors` | `shared/forms/serverErrors` | the mapping |
| `EntityPicker` | `components/forms/EntityPicker` | search-as-you-type picker over a typed list |
| `DirectoryFormPage` | `modules/directory/DirectoryFormPage` | a create/edit page from a config; prefills from URL search params by field name |
| `FieldInputs`, `pickers` | `modules/directory/FieldInputs`, `modules/directory/pickers` | the input kinds a config can use |
| `formModel` | `modules/directory/formModel` | config → values, payload and validation |

## Lists and records

| Piece | Source | Notes |
|---|---|---|
| `listFetcher`, `fetchAllRows` | `shared/data/listing` | never fetch page 1 and treat it as the whole list |
| `usePaginatedList` | `shared/data/usePaginatedList` | |
| `createQueryKeys` | `shared/data/queryKeys` | |
| `exportAll` | `shared/data/exportAll` | CSV/JSON export of a whole list |
| `DirectoryListPage` | `modules/directory/DirectoryListPage` | a list screen from a config (filters, columns, row actions, archive/restore) |
| `RelatedRecords` | `modules/directory/RelatedRecords` | the records that point at this one, with a server-side count |
| `EntityHistory` | `components/history/EntityHistory` | the record's audit history |
| bulk screens | `shared/components/bulk/` | preview, resolve, result, validation; types in `bulk/types.ts` |

## Record workspace chrome

| Piece | Source | Notes |
|---|---|---|
| `WorkspaceShell`, `CanonicalWorkspaceHeader`, `WorkspaceActionBar`, `WorkspaceOverflowMenu`, `WorkspaceOpenButton` | `shared/workspace/canonical/` (barrel `index.ts`) | an action has `permission` (a backend code) and may have `confirm` |
| `WorkspaceShell` (directory) | `modules/directory/workspace/WorkspaceShell` | the shell the directory record workspaces use |
| `DetailGrid`, `RecordActions`, `PeopleTab`, `PersonLabel`, `ProjectsOfClient`, `TeamsOfDepartment`, `TeamMembersTab` | `modules/directory/workspace/` | the parts the client, vendor, department, office, team and person workspaces share |

## Permissions

| Piece | Source | Notes |
|---|---|---|
| `useCan(code \| codes, { projectId, showId, mode })` | `core/permissions/useCan` | the one way to ask; codes are backend permission codes |
| `usePermissions` | `core/permissions/usePermissions` | `can(query)` with the chosen project as the default scope |
| `PermissionGate`, `PermissionButton`, `PermissionMenuItem` | `core/permissions/PermissionComponents` | hide or disable by code |
| `usePermissionControl`, `PermissionControlled`, `PermissionActionButton` | `core/permissions/PermissionControl` | disable / hide / read-only by mode; `Button` uses it |
| route registry | `core/permissions/routePermissionsRegistry` | every route needs an entry; a test fails on a gate code with no rule |

## Layout

| Piece | Source |
|---|---|
| `AppLayout`, `Sidebar`, `Header`, `Breadcrumbs`, `ProjectSwitcher` | `layouts/` |
| `LayoutDensityControl` | `shared/layouts/LayoutDensityControl` |
| error pages | `pages/` (401, 403, 404, 500, no project access) |

## Small utilities

| Piece | Source |
|---|---|
| `cn` | `shared/utils/cn` |
| `safeWebUrl` | `shared/utils/safeUrl` (only http(s) becomes an `href`) |
| `useDebouncedValue`, `useKeyboardNavigation`, `useBulkEntity` | `shared/hooks/` |
