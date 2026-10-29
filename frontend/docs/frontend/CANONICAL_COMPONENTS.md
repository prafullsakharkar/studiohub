# Canonical Components Registry

> Single authoritative reference for shared UI/UX implementations in StudioHub frontend.
> **Rule: one implementation per pattern. Features import from the canonical barrel, never from `shared/` internals or module-local copies.**

Canonical barrel: `src/components/index.ts`

```tsx
// Correct — one import surface
import { Button, Dialog, DataTable, LoadingState, PermissionGate } from '@/components';

// Forbidden — bypasses the canonical surface
import { Button } from '@/shared/components/Button';
import { Dialog } from '@/shared/components/Dialog';
```

## Ownership Hierarchy

| Directory | Owns | Must not contain |
|---|---|---|
| `components/ui` | Generic visual primitives (Button, Badge, Card, Input, Dialog, Drawer, Modal…) | Domain logic, data fetching |
| `components/data` | Data presentation (DataTable, FilterBar) | Domain logic, routes |
| `components/workspace` | Workspace chrome (Workspace, Header, Tabs, Drawer) | Business rules |
| `components/entity` | Generic entity presentation, configuration-driven entity registry | Hard-coded domain data |
| `components/forms` | Form machinery (FormDialog, FormDrawer, FormSection) | Zod schemas, API calls |
| `components/navigation` | Global/context navigation (switchers, search) | Page content |
| `components/system` | Cross-cutting infrastructure (Loading/Error states, Gates) | Domain components |

Domain behavior stays in `src/modules/<module>/` — canonical components are configuration-driven.

## Canonical Inventory

### ui — visual primitives

| Component | Source | Notes |
|---|---|---|
| `Button` | `shared/components/Button` (re-exported) | Variants: primary/secondary/outline/ghost/danger |
| `IconButton` | `components/ui/IconButton` | Standardized icon button with size, variant, tooltip, and RBAC support |
| `Tooltip` | `components/ui/Tooltip` | Accessible keyboard & hover tooltip with 4-direction placement |
| `Select` | `components/ui/Select` | Accessible styled select with label, error, helperText, and options |
| `Checkbox` | `components/ui/Checkbox` | Accessible checkbox supporting label, description, indeterminate, and error |
| `Switch` | `components/ui/Switch` | Accessible toggle switch with role="switch" and keyboard navigation |
| `Chip` | `components/ui/Chip` | Tag / chip primitive with variant, onRemove, click handlers, and icons |
| `Avatar` | `components/ui/Avatar` | User / entity avatar with status dot, image fallback, and initials hashing |
| `Tabs` | `components/ui/Tabs` | Accessible tablist supporting keyboard arrows, badges, and variants |
| `Menu` / `Dropdown` | `components/ui/Menu` | Accessible popover dropdown menu with divider and danger support |
| `Badge` | `shared/components/Badge` (re-exported) | |
| `StatusBadge` / `PriorityBadge` | `shared/components/StatusBadge` (re-exported) | Production status/priority mapping |
| `Card` | `shared/components/Card` (re-exported) | |
| `Input` | `shared/components/Input` (re-exported) | |
| `SearchInput` | `shared/components/SearchInput` (re-exported) | Debounced search field |
| `Pagination` | `shared/components/Pagination` (re-exported) | DRF-style pagination controls |
| `Modal` | `shared/components/Modal` (re-exported) | Legacy-simple modal |
| `Dialog` | `components/ui/Dialog` | Canonical dialog (focus trap, ESC, overlay) |
| `Drawer` | `components/ui/Drawer` | Canonical side drawer |

### data — data presentation

| Component | Source | Notes |
|---|---|---|
| `DataTable` / `DataGrid` | `components/data/DataTable` | Sort, selection, empty/loading/error states, row actions |
| `FilterBar` | `components/data/FilterBar` | Search + type/status filters, URL-sync friendly |
| `ColumnManager` | `components/data/ColumnManager` | Column visibility toggle popover with search and reset |
| `BulkActions` / `BulkActionBar` | `components/data` (re-exported) | Bulk selection action bar |

### workspace — chrome

| Component | Source | Notes |
|---|---|---|
| `Workspace` | `shared/workspace/Workspace` | Canonical workspace wrapper |
| `WorkspaceHeader` | `shared/workspace/WorkspaceHeader` | Workspace header chrome |
| `WorkspaceActionBar` | `shared/workspace/canonical/*` | Workspace action bar |
| `WorkspaceOverflowMenu` | `shared/workspace/canonical/*` | Overflow menu for actions |
| `WorkspaceTabs` | `shared/workspace/WorkspaceTabs` | Multi-tab workspace coordinator |
| `WorkspacePanel` | `shared/workspace/WorkspacePanel` | Workspace panels |
| `SplitView` | `shared/workspace/SplitView` | Resizable / multi-pane split layout |
| `EntityDrawer` | `shared/workspace/EntityDrawer` | Slide-out entity inspector |
| `PeekPanel` | `shared/workspace/PeekPanel` | Quick peek inspector drawer |
| `ContextBar` | `shared/workspace/ContextBar` | Persistent context display |
| `WorkspacePersistence` | `core/workspace/workspacePersistence` | Local storage state retention |

### entity — entity presentation

| Component | Source | Notes |
|---|---|---|
| `EntityHeader` | `components/entity` | Canonical entity header |
| `EntitySummary` | `components/entity/EntitySummary` | Card summary with avatar, badges, description, and metadata |
| `EntityMetadata` | `components/entity/EntityMetadata` | Key-value attribute grid with copy-to-clipboard |
| `EntityStatus` | `components/entity/EntityStatus` | Interactive status changer with transition rules |
| `EntitySidebar` | `components/entity/EntitySidebar` | Dedicated inspector panel for entities |
| `EntityComments` | `components/entity/EntityComments` | Comment thread and internal notes |
| `EntityHistory` | `components/entity/EntityHistory` | Audit trail and revision timeline |
| `EntityActions` | `components/entity/EntityActions` | Action toolbar with permission controls |
| `entityConfig` | `core/workspace/entityRegistry` | Configuration-driven entity metadata, relations, tags |

### forms — form machinery

| Component | Source | Notes |
|---|---|---|
| `FormField` | `components/forms/FormField` | Accessible field wrapper with label, tooltip, counter, error, helper |
| `FormDialog` | `components/forms/FormDialog` | Modal form with submit/cancel/loading contract |
| `FormDrawer` | `components/forms/FormDrawer` | Drawer form variant |
| `FormSection` | `components/forms/FormSection` | Grouped fields with title/description |
| `AsyncEntitySelect` | `components/forms` | Debounced multi-entity async relationship selector |
| `RelationshipSelector` | `components/forms` | Entity relationship picker |

### navigation — global/context navigation

| Component | Source | Notes |
|---|---|---|
| `Breadcrumbs` | `layouts/Breadcrumbs` | Route breadcrumbs |
| `OrganizationSwitcher` | `layouts/OrganizationSwitcher` | Org switcher |
| `ProjectSwitcher` | `layouts/ProjectSwitcher` | Project switcher |
| `ShowSwitcher` / `ShowSelector` | `layouts/ShowSwitcher` | Show selector |
| `CommandPalette` | `shared/components/CommandPalette` | Global cmd+k command palette |
| `GlobalSearch` | `modules/intelligence/components/search` | Global entity search |
| `EntitySearchModal` | `shared/workspace/UniversalEntitySearchModal` | Entity search modal |

### system — cross-cutting infrastructure

| Component | Source | Notes |
|---|---|---|
| `LoadingState` | `components/system` | Full-area loading with skeleton |
| `ErrorState` / `ApiErrorState` / `NetworkError` / `ServerError` | `components/system` | Error presentation ladder |
| `NotFoundState` / `AccessDenied` / `AccountLocked` / `AccountDisabled` / `SessionExpired` | `components/system` | Terminal-state screens |
| `ConfirmDialog` | `components/system` | Destructive-action confirmation |
| `RetryButton` | `components/system` | Standard retry affordance |
| `ValidationSummary` | `components/system` | Form error rollup |
| `FeatureGate` / `PermissionGate` | `components/system` | Feature-flag and RBAC conditional rendering |

## Import Rules

1. **Features must import canonical components from `@/components`.**
2. **`@/shared/components/*` imports are transitional only** — allowed inside the canonical barrel, not in feature code for patterns the barrel already exports.
3. **Do not create a second implementation** of any listed pattern (no local `MyDialog`, no module-level `StatusBadge` clone). Extend the canonical component instead.
4. **New shared patterns** go through the ownership table above, then get exported from the barrel.
5. Module-specific components that exist only for one domain stay in `src/modules/<module>/components/`.

## Optional-field display convention

Entity fields that are optional in the API contract (`title?`, `department?`, `created_at?`, `shot_count?`…) are normalized at the usage site with fallbacks:

```tsx
title={media.title ?? media.file_name ?? media.code}      // display fallback chain
{new Date(entity.created_at ?? Date.now()).toLocaleDateString()}  // timestamp display
width: `${(seq.shot_count ?? 0) > 0 ? ... : 0}%`          // numeric guards
```

Types are **not** loosened to make call sites compile — the API contract stays honest.

## Migration Status

- [x] Canonical barrel `src/components/index.ts` established
- [x] `system` state components consolidated (Loading/Error/Empty/Gate set)
- [x] `ui` primitives exposed through barrel (re-exports + Dialog/Drawer)
- [x] `data` DataTable/FilterBar canonical
- [x] `forms` FormDialog/FormDrawer/FormSection canonical
- [x] Entity registry (`core/workspace/entityRegistry`) configuration-driven
- [ ] `components/workspace` — populate as workspace chrome migrates off `shared/workspace`
- [ ] `components/navigation` — populate as switchers/palette extract
- [ ] Sweep feature code for direct `@/shared/components` imports and convert to `@/components`
- [ ] Remove duplicated module-local state components (404/403 pages now route through canonical states)

## Quality Gates

All must pass before merging frontend changes:

```bash
pnpm typecheck   # tsc --noEmit — 0 errors
pnpm test        # vitest run — all green
pnpm build       # vite build + esbuild server
```
