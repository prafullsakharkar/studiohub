# Organization Workspace Entity Views Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every CRUD tab of the Organization Workspace a consistent Card/Table toggle with server-driven search, filter, sort, pagination, and CRUD, built only on existing shared components plus three minimal extensions.

**Architecture:** Per-tab entity configs drive `EntityTable` (controlled server mode) + `GridView` + a `ScrollableTabs`-segments toggle; view mode persists per section via a new `usePersistedViewMode` hook; backend nested routes gain opt-in pagination. No new component architecture.

**Tech Stack:** React 19 + TypeScript, TanStack Query, existing `shared/crud`, `shared/views`, `shared/components`, DRF backend in `../studiohub/backend`.

**Spec:** `docs/superpowers/specs/2026-10-08-org-workspace-entity-views-design.md`

**Spec refinement (approved deviation):** Spec §2 names `ProductionView` as the engine. `ProductionView` (`src/shared/views/ProductionView.tsx`) has no server-pagination path (it slices client-side, lines 179-182) and renders all 7 view modes via `SavedViewsBar`, which accepts no mode restriction (`src/shared/views/SavedViewsBar.tsx:27-35`). Meeting the spec's own server-pagination requirement therefore uses `EntityTable` controlled mode (`src/shared/crud/EntityTable.tsx:30-42`) + `GridView` + toggle. Everything else in the spec stands. View-mode persistence uses a new `studiohub_entity_view_<entityType>` key (same pattern family as `studiohub_pagination_*`) instead of the saved-views store, since `SavedViewsBar` is not mounted.

## Global Constraints

- TypeScript strict: `npx tsc --noEmit` clean after every task.
- Tests: `npx vitest run` fully green after every task; new behavior gets a failing-first test.
- No new permission strings; gate with existing `definitions/*Definition.ts` matrices and `Button` permission props / `BulkActionBar.canPerform`.
- No per-tab UI forks: tab variance lives only in entity config objects; shared rendering code is touched only in Task 2 extensions.
- Backend stays backward compatible: unpaginated requests keep bare-array responses.
- UI only for verification: Playwright against `http://localhost:3100` with Django on `http://127.0.0.1:8000`; never seed via API for verification flows.

## Review Focus

- Stale closure on server-query params (search text vs page vs sort applied to an older queryKey) — expect params echoed in the request URL test.
- Envelope mismatch (paginated `{results, count}` vs bare array) breaking selectors that read `.results` — expect both-shape tests.
- Permission-gated buttons still firing mutations when hidden via CSS rather than unmounted — expect hidden-means-absent assertions.
- View-mode key collision between two tabs sharing an `entityType` — expect distinct storage keys per tab.
- Backend pagination changing default ordering of existing bare-array consumers — expect order-preservation check without paging params.

## File map

Created:
- `src/shared/hooks/usePersistedViewMode.ts` — persisted `table|grid` toggle state.
- `src/shared/hooks/__tests__/usePersistedViewMode.test.tsx`
- `src/modules/organization/components/tabs/configs/entityViewConfig.ts` — config type + shared action builders.
- `src/modules/organization/components/tabs/configs/departmentsConfig.ts`
- `src/modules/organization/components/tabs/configs/peopleConfig.ts`
- `src/modules/organization/components/tabs/configs/teamsConfig.ts`, `officesConfig.ts`, `positionsConfig.ts` (batch 2)
- `src/modules/organization/components/tabs/configs/clientsConfig.ts`, `vendorsConfig.ts`, `projectsConfig.ts`, `calendarsConfig.ts`, `holidaysConfig.ts`, `workCalendarsConfig.ts`, `catalogsConfig.ts`, `apiKeysConfig.ts`, `accessListsConfig.ts` (batch 3)
- `src/modules/organization/components/tabs/configs/__tests__/entityViewConfigs.test.ts` — contract tests.

Modified:
- `src/shared/crud/EntityTable.tsx` — add optional server-sort delegation prop.
- `src/shared/views/views/GridView.tsx` — add optional `renderCard` override prop.
- `src/modules/organization/api/organizationApi.ts` — normalize paginated envelopes, forward `ordering`.
- `src/modules/organization/components/tabs/DepartmentsTab.tsx`, `PeopleTab.tsx`, `TeamsTab.tsx`, `OfficesTab.tsx`, `PositionsTab.tsx`, `ClientsTab.tsx`, `VendorsTab.tsx`, `ProjectsTab.tsx`, `WorkCalendarsTab.tsx`, `CalendarsTab.tsx`, `HolidaysTab.tsx`, master-data `OrgSoftwareConfig.tsx`, `OrgStatusConfig.tsx`, `OrgTaskTypeConfig.tsx`, `OrgCatalogConfig.tsx`, `ApiKeysTab.tsx`, `PersonalAccessTokensTab.tsx`, access `RolesWorkspaceSection.tsx`, `GroupsManagementSection.tsx`, `UserAccessSection.tsx` (list halves only).
- Backend (`../studiohub/backend`): `apps/organization/api/viewsets/legacy.py`, `apps/organization/api/filtersets/*.py` (add missing sets), Org API tests.

---

### Task 1: Backend opt-in pagination on nested org routes

**Files:**
- Modify: `../studiohub/backend/apps/organization/api/viewsets/legacy.py`
- Modify: `../studiohub/backend/apps/organization/api/filtersets/department.py`, `team.py`, `position.py` (add only missing fields; `office.py` already has `OfficeFilterSet`)
- Test: `../studiohub/backend/apps/organization/tests/` (existing suite) + manual curl checks

**Interfaces:**
- Consumes: `StandardPagination` from `apps.core.api.pagination` (already used by canonical viewsets).
- Produces: nested `GET /api/organizations/<org>/<resource>/?page=1&page_size=25&search=x&ordering=name` returns `{results, count}`; requests without paging params return bare arrays exactly as today.

**Steps:**

- [ ] **Step 1: Add an opt-in pagination class next to the legacy aliases.**

In `../studiohub/backend/apps/organization/api/viewsets/legacy.py`, above `LegacyDepartmentViewSet`, add:

```python
from apps.core.api.pagination import StandardPagination


class OptionalPagination(StandardPagination):
    """Paginate only when the client asks (?page= or ?page_size= present).

    Preserves the bare-array contract for existing callers (OrgEntitySelector
    dropdowns, tab lists) while enabling server-driven tables.
    """

    def paginate_queryset(self, queryset, request, view=None):
        if 'page' not in request.query_params and 'page_size' not in request.query_params:
            return None
        return super().paginate_queryset(queryset, request, view=view)
```

- [ ] **Step 2: Point every bare-array alias at it.**

Replace each `pagination_class = None` in `LegacyDepartmentViewSet`, `LegacyTeamViewSet`, `LegacyOfficeViewSet`, `CompatPositionViewSet`, `CompatInvitationViewSet`, `CompatWorkCalendarViewSet`, `CompatWorkHoursViewSet`, `CompatCalendarViewSet`, `CompatHolidayViewSet` with `pagination_class = OptionalPagination`.

- [ ] **Step 3: Fill search/ordering/filter gaps per resource.**

Ensure each canonical viewset used by the aliases declares `search_fields` (name, code plus city/country/title where the model has them), `ordering_fields = ('code', 'name', 'created_at', 'updated_at')`, and a `filterset_class`; add `department`, `seniority_level`, `office`/`status` filters where the model supports them, mirroring the existing `OfficeFilterSet` pattern in `apps/organization/api/filtersets/office.py`.

- [ ] **Step 4: Run backend org tests.**

Run: `cd ../studiohub/backend && python manage.py test apps.organization 2>&1 | tail -5`
Expected: all pass (no failures/errors).

- [ ] **Step 5: Curl-verify both shapes against the dev server.**

Run (Django on `http://127.0.0.1:8000`, authed request):
`curl -s '.../api/organizations/<org>/departments/'` returns a JSON array (unchanged), and with `?page=1&page_size=2&search=x&ordering=name` returns an object with `results` and `count` keys.
Expected: bare array without params; envelope with params; ordering respected.

- [ ] **Step 6: Commit.**

```bash
git add apps/organization/api/viewsets/legacy.py apps/organization/api/filtersets/
git commit -m "feat(api): opt-in pagination + search/ordering on nested org routes"
```

---

### Task 2: Shared frontend extensions (the only new/changed shared code)

**Files:**
- Create: `src/shared/hooks/usePersistedViewMode.ts`
- Create: `src/shared/hooks/__tests__/usePersistedViewMode.test.tsx`
- Modify: `src/shared/crud/EntityTable.tsx` (add `onSortChange` prop only)
- Modify: `src/shared/views/views/GridView.tsx` (add `renderCard` prop only)

**Interfaces:**
- Consumes: `DataViewMode`, `SortConfig` from `@/types/common`; `localStorage` key pattern `studiohub_*`.
- Produces: `usePersistedViewMode(entityType: string): [DataViewMode, (m: DataViewMode) => void]`; `EntityTable` prop `onSortChange?: (sort: SortConfig[]) => void` (when present, local sort is skipped and the parent owns `ordering`); `GridView` prop `renderCard?: (item: T) => React.ReactNode` (default rendering unchanged when absent).

**Steps:**

- [ ] **Step 1: Write the failing hook test.**

```tsx
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePersistedViewMode } from '../usePersistedViewMode';

describe('usePersistedViewMode', () => {
  it('persists the mode per entity type across mounts', () => {
    localStorage.clear();
    const { result, unmount } = renderHook(() => usePersistedViewMode('department'));
    expect(result.current[0]).toBe('table');
    act(() => result.current[1]('grid'));
    unmount();
    const second = renderHook(() => usePersistedViewMode('department'));
    expect(second.result.current[0]).toBe('grid');
    const other = renderHook(() => usePersistedViewMode('team'));
    expect(other.result.current[0]).toBe('table');
  });
});
```

- [ ] **Step 2: Run it to verify it fails.**

Run: `npx vitest run src/shared/hooks/__tests__/usePersistedViewMode.test.tsx`
Expected: FAIL with "function not defined" / module missing.

- [ ] **Step 3: Implement the hook.**

```ts
import { useState } from 'react';
import type { DataViewMode } from '@/types/common';

type EntityViewMode = 'table' | 'grid';

const keyFor = (entityType: string) => `studiohub_entity_view_${entityType}`;

export function usePersistedViewMode(entityType: string): [EntityViewMode, (m: EntityViewMode) => void] {
  const [mode, setMode] = useState<EntityViewMode>(() => {
    try {
      const raw = localStorage.getItem(keyFor(entityType));
      return raw === 'grid' || raw === 'table' ? raw : 'table';
    } catch {
      return 'table';
    }
  });
  const set = (m: EntityViewMode) => {
    setMode(m);
    try {
      localStorage.setItem(keyFor(entityType), m);
    } catch {
      // storage unavailable (private mode): state still works for the session
    }
  };
  return [mode, set];
}
```

- [ ] **Step 4: Run the test to verify it passes.**

Run: `npx vitest run src/shared/hooks/__tests__/usePersistedViewMode.test.tsx`
Expected: PASS.

- [ ] **Step 5: Add server-sort delegation to EntityTable.**

In `EntityTableProps` add `onSortChange?: (sort: SortConfig[]) => void;`, accept it in the component signature, and change `handleSortChange` to:

```tsx
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
```

and change the `filteredAndSorted` memo to skip local sorting when delegation is active: `if (!onSortChange && sortConfig.length > 0) { ...existing sort body... }`.

- [ ] **Step 6: Add renderCard override to GridView.**

Add `renderCard?: (item: T) => React.ReactNode;` to `GridViewProps`, accept it, and inside `data.map` return `renderCard ? <div key={item.id}>{renderCard(item)}</div> : (<existing card jsx>)`. Default path byte-identical.

- [ ] **Step 7: Run related suites + typecheck.**

Run: `npx vitest run src/shared/crud/__tests__/EntityTable.test.tsx src/shared/hooks/__tests__/usePersistedViewMode.test.tsx` — Expected: PASS.
Run: `npx tsc --noEmit` — Expected: clean.

- [ ] **Step 8: Commit.**

```bash
git add src/shared/hooks/usePersistedViewMode.ts src/shared/hooks/__tests__/usePersistedViewMode.test.tsx src/shared/crud/EntityTable.tsx src/shared/views/views/GridView.tsx
git commit -m "feat(shared): persisted view mode, server-sort delegation, grid card override"
```

---

### Task 3: Frontend API normalization for paginated envelopes

**Files:**
- Modify: `src/modules/organization/api/organizationApi.ts` (list fns: `getDepartments`, `getTeams`, `getOffices`, `getPeople`, `getPositions`, `getClients`, `getVendors`, `getProjects`, calendars/holidays/keys where shaped as bare arrays)
- Test: extend `src/modules/organization/api/__tests__/` (create `organizationApi.pagination.test.ts` if no file exists; check first with `ls src/modules/organization/api/__tests__/`)

**Interfaces:**
- Consumes: Task 1 backend (envelope `{results, count}` when paging params present).
- Produces: every org list fn accepts `{search, ordering, page, page_size}` passthrough and returns `{ items: T[]; totalCount: number | null }` where `totalCount` is `null` for bare-array responses so callers can fall back to client mode. Normalizers keep existing id aliasing (`id ?? uuid`, `department_id ?? department`, `manager_id ?? manager`).

**Steps:**

- [ ] **Step 1: Write the failing normalization test.**

```ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/api/client/ApiClient', () => ({
  apiClient: { get: vi.fn() },
}));
import { apiClient } from '@/api/client/ApiClient';
import { organizationApi } from '../organizationApi';

describe('org list pagination envelopes', () => {
  it('maps paginated envelope to items + totalCount', async () => {
    (apiClient.get as any).mockResolvedValue({ results: [{ id: 'd1' }], count: 42 });
    const res = await organizationApi.getDepartments({ page: 1, page_size: 25 }, 'org-1');
    expect(res).toEqual({ items: [{ id: 'd1' }], totalCount: 42 });
  });
  it('maps bare arrays to items + null count', async () => {
    (apiClient.get as any).mockResolvedValue([{ id: 'd1' }]);
    const res = await organizationApi.getDepartments(undefined, 'org-1');
    expect(res).toEqual({ items: [{ id: 'd1' }], totalCount: null });
  });
});
```

- [ ] **Step 2: Run it to verify it fails.**

Run: `npx vitest run src/modules/organization/api/__tests__/organizationApi.pagination.test.ts`
Expected: FAIL (shape mismatch; current fns return raw arrays).

- [ ] **Step 3: Implement normalization in each list fn.**

For each fn, capture the raw response, then:

```ts
const items = (Array.isArray(res) ? res : res?.results ?? []).map((t: any) => ({
  ...t,
  id: t.id ?? t.uuid,
  // keep each fn's existing alias lines here
}));
return { items, totalCount: Array.isArray(res) ? null : (res?.count ?? null) };
```

Keep every existing alias line (`department_id ?? department`, `manager_id ?? manager`, etc.) inside the map. Update hook call sites only where TypeScript requires it (Task 4+ handle tabs; other consumers like `OrgEntitySelector` keep working — add a compatibility note only if a type error appears, and fix by reading `.items` at that call site).

- [ ] **Step 4: Run tests + typecheck.**

Run: `npx vitest run src/modules/organization/api/__tests__/organizationApi.pagination.test.ts` — Expected: PASS.
Run: `npx tsc --noEmit` — Expected: clean (fix `.items` at any failing consumer).

- [ ] **Step 5: Commit.**

```bash
git add src/modules/organization/api/organizationApi.ts src/modules/organization/api/__tests__/organizationApi.pagination.test.ts
git commit -m "feat(org-api): paginated envelope normalization with bare-array fallback"
```

---

### Task 4: Entity config framework + pilot tabs (departments, people)

**Files:**
- Create: `src/modules/organization/components/tabs/configs/entityViewConfig.ts`
- Create: `src/modules/organization/components/tabs/configs/departmentsConfig.ts`
- Create: `src/modules/organization/components/tabs/configs/peopleConfig.ts`
- Create: `src/modules/organization/components/tabs/configs/__tests__/entityViewConfigs.test.ts`
- Modify: `src/modules/organization/components/tabs/DepartmentsTab.tsx`
- Modify: `src/modules/organization/components/tabs/PeopleTab.tsx`

**Interfaces:**
- Consumes: `FieldDefinition`, `EntityAction`, `BulkAction` from `@/types/common`; existing mutation hooks; `usePersistedViewMode`; `EntityTable`; `GridView`; `ScrollableTabs` (`variant="segments"`); `DeleteDialog`; existing modals and `openTab` navigation.
- Produces: `OrgEntityViewConfig<T>`:

```ts
interface OrgEntityViewConfig<T extends { id: string }> {
  entityType: string;
  searchPlaceholder: string;
  fields: FieldDefinition<T>[];
  cardFields: { title: (i: T) => string; subtitle?: (i: T) => string; badges: (i: T) => { label: string; variant: string }[]; meta: (i: T) => { label: string; value: string }[] };
  permissions: { create: string; update: string; delete: string; view: string };
  createLabel: string;
  detailRoute: (i: T) => string;
  workspaceType: 'department' | 'person' | 'team' | 'office';
  deletable: boolean;
  bulkDeletable: boolean;
}
```

plus `buildRowActions(config, { onView, onEdit, onDelete })` returning `EntityAction[]` with View/Edit/Delete entries, each carrying its permission string so hidden-means-absent, and `validateEntityViewConfig(config)` used by contract tests (asserts non-empty fields, every permission string matches `/^[a-z_]+\.(view|create|update|delete)$/`, `detailRoute` returns a `/`-prefixed path for a sample item).

**Steps:**

- [ ] **Step 1: Write failing contract tests for the two pilot configs.**

```ts
import { describe, it, expect } from 'vitest';
import { departmentsConfig } from '../departmentsConfig';
import { peopleConfig } from '../peopleConfig';
import { validateEntityViewConfig } from '../entityViewConfig';

describe('entity view configs', () => {
  it('departments config is valid and wired', () => {
    expect(() => validateEntityViewConfig(departmentsConfig)).not.toThrow();
    expect(departmentsConfig.entityType).toBe('department');
    expect(departmentsConfig.detailRoute({ id: 'd1' } as any)).toBe('/departments/d1');
  });
  it('people config is valid and wired', () => {
    expect(() => validateEntityViewConfig(peopleConfig)).not.toThrow();
    expect(peopleConfig.entityType).toBe('person');
    expect(peopleConfig.detailRoute({ id: 'p1' } as any)).toBe('/people/p1');
  });
});
```

- [ ] **Step 2: Run to verify they fail.**

Run: `npx vitest run src/modules/organization/components/tabs/configs/__tests__/entityViewConfigs.test.ts`
Expected: FAIL (modules missing).

- [ ] **Step 3: Implement `entityViewConfig.ts`, `departmentsConfig.ts`, `peopleConfig.ts`.**

Departments fields mirror the current card content: name, code (mono), head_name (Supervisor), member_count (Artists), description, software_stack (render chips via `render`). People fields mirror the current table: full_name (+email subline via `render`), role, department_name (badge), office_name, active_tasks (mono, sortable), seniority (badge). Card mappers reuse the same accessors. Permissions: `department.view/create/update/delete`, `people.view/create/update/delete`. `deletable: true`, `bulkDeletable: false` for pilot (single delete only; bulk stays off until batch 3 verifies safe multi-delete per resource).

- [ ] **Step 4: Run contract tests to verify they pass.**

Run: `npx vitest run src/modules/organization/components/tabs/configs/__tests__/entityViewConfigs.test.ts`
Expected: PASS.

- [ ] **Step 5: Convert DepartmentsTab list layer (keep modal, navigation, delete mutation).**

Replace the card-grid JSX + empty block with: header row (existing title/description + `Add Department` button gated by `can('department.create')` + `CloneMasterButton`), `ScrollableTabs variant="segments"` bound to `usePersistedViewMode('department')`, `EntityTable` in controlled server mode (`page/totalCount/onPageChange/onSortChange→ordering/searchQuery/onSearchChange`), `GridView` with `renderCard` from config in grid mode, `DeleteDialog` replacing `confirm()`. Server query: `useDepartments({ search, ordering, page, page_size }, org.id)` reading `{ items, totalCount }` from Task 3. Row/card click keeps `handleOpenWorkspace`. Add `EmptyState` for empty, error text for `isError`, and render nothing list-like without `can('department.view')` (workspace already gates; this is defense in depth).

- [ ] **Step 6: Convert PeopleTab list layer identically.**

Same shell with `peopleConfig`; keep Invite modal, `Profile` navigation, `deletePerson` behind `DeleteDialog`; preserve the department `<select>` as a `department_name` server filter param alongside search; gate Invite on `people.create`, delete on `people.delete`.

- [ ] **Step 7: Update existing tests whose DOM queries change, run suites + typecheck.**

Run: `npx vitest run src/features/organizations/__tests__/pages/TeamDepartmentOfficeForms.test.tsx src/modules/organization/`
Expected: PASS (update role/name queries only where the rendered output legitimately changed; never weaken an assertion to force green).
Run: `npx tsc --noEmit` — Expected: clean.

- [ ] **Step 8: Playwright-verify both tabs (admin + restricted role).**

Admin: toggle Card/Table on departments, reload, assert toggle persisted; create → search → sort → paginate via network-asserted server params; delete via dialog; same for people invite. Restricted role (no `department.create`): assert Add button absent and row actions lack Edit/Delete. Perform strictly through UI at `http://localhost:3100`.

- [ ] **Step 9: Commit.**

```bash
git add src/modules/organization/components/tabs/configs/ src/modules/organization/components/tabs/DepartmentsTab.tsx src/modules/organization/components/tabs/PeopleTab.tsx
git commit -m "feat(org-workspace): unified card/table views for departments + people"
```

---

### Task 5: Batch 2 — teams, offices, positions

**Files:**
- Create: `teamsConfig.ts`, `officesConfig.ts`, `positionsConfig.ts` + extend contract tests.
- Modify: `TeamsTab.tsx`, `OfficesTab.tsx`, `PositionsTab.tsx`.

**Interfaces:**
- Consumes: Task 4 framework (config type, validators, shell pattern).
- Produces: same shell on three more tabs; positions keeps its KPI strip, filter bar (wired as server params), inspect modal, and master-roles section above the unified list.

**Steps:**

- [ ] **Step 1: Extend contract tests with the three configs (copy Task 4 Step 1 shape, detail routes `/teams/:id`, `/offices/:id`, positions inspect modal instead of route).** Run — Expected: FAIL (missing).
- [ ] **Step 2: Implement the three configs.** Teams: name/code/lead_name/member/focus_discipline/current_project_code/department_name; parent-department required stays in the modal. Offices: city/country/timezone/status/address/occupancy/manager_name; create payload keeps Task-0-era contract fields (`organization`, `code`, `office_type`) already fixed in `useOfficeMutations`. Positions: title/code/department_name/seniority/band/salary/type/headcount; `deletable` per current archive semantics.
- [ ] **Step 3: Convert the three tabs following Task 4 Steps 5–6 exactly** (same shell, same gating, same dialog replacement, same server-param wiring; positions filter selects become server params; teams keep assigned-show display via existing fields).
- [ ] **Step 4: Run suites + typecheck** (`npx vitest run src/modules/organization/`, `npx tsc --noEmit`) — Expected: green.
- [ ] **Step 5: Playwright-verify create/edit/delete + toggle persistence on all three tabs.**
- [ ] **Step 6: Commit** (`git commit -m "feat(org-workspace): unified card/table views for teams, offices, positions"`).

---

### Task 6: Batch 3 — remaining CRUD tabs

**Files:**
- Create: `clientsConfig.ts`, `vendorsConfig.ts`, `projectsConfig.ts`, `workCalendarsConfig.ts`, `calendarsConfig.ts`, `holidaysConfig.ts`, `softwareConfig.ts`, `statusesConfig.ts`, `taskTypesConfig.ts`, `catalogsConfig.ts` (asset/shot/review/file share one factory with `dataType` param, mirroring `OrgCatalogConfig`), `apiKeysConfig.ts`, `patsConfig.ts`, `rolesListConfig.ts`, `groupsListConfig.ts`, `usersListConfig.ts` + contract tests.
- Modify: `ClientsTab.tsx`, `VendorsTab.tsx`, `ProjectsTab.tsx`, `WorkCalendarsTab.tsx`, `CalendarsTab.tsx`, `HolidaysTab.tsx`, master-data `OrgSoftwareConfig.tsx`, `OrgStatusConfig.tsx`, `OrgTaskTypeConfig.tsx`, `OrgCatalogConfig.tsx`, `ApiKeysTab.tsx`, `PersonalAccessTokensTab.tsx`, access `RolesWorkspaceSection.tsx`, `GroupsManagementSection.tsx`, `UserAccessSection.tsx` (list halves only; inspectors untouched).

**Interfaces:**
- Consumes: Task 4 framework.
- Produces: unified shell everywhere in scope; `deletable: false` for clients/vendors/catalogs; enable/disable toggles stay as row actions (not delete); one-time secret reveal modals untouched; roles/groups keep custom create/edit modals.

**Steps:**

- [ ] **Step 1: Extend contract tests per config (same shape as Task 4).** Run — Expected: FAIL.
- [ ] **Step 2: Implement configs** (clients/vendors: no delete action; catalogs: enable-toggle action instead of delete; api-keys/pats: revoke vs delete mapping to existing mutations; calendars/holidays: `DeleteDialog` replacing confirm-less deletes).
- [ ] **Step 3: Convert tabs following the Task 4 shell**; for roles/groups/users convert only the left list, keeping inspectors and their modals verbatim.
- [ ] **Step 4: Run full suite + typecheck** (`npx vitest run`, `npx tsc --noEmit`) — Expected: green.
- [ ] **Step 5: Playwright-verify each converted tab** (toggle persistence + one CRUD round-trip per tab, admin and restricted role).
- [ ] **Step 6: Commit** (`git commit -m "feat(org-workspace): unified card/table views for remaining CRUD tabs"`).

---

### Task 7: Final verification and cleanup

**Files:** none (verification only).

**Steps:**

- [ ] **Step 1: Full test suite.** Run: `npx vitest run` — Expected: all files pass.
- [ ] **Step 2: Typecheck.** Run: `npx tsc --noEmit` — Expected: clean.
- [ ] **Step 3: Lint changed files.** Run: `npx biome check src/modules/organization/components/tabs/ src/shared/hooks/usePersistedViewMode.ts src/shared/crud/EntityTable.tsx src/shared/views/views/GridView.tsx` — Expected: no errors (fix or document any pre-existing warnings touched by this work).
- [ ] **Step 4: Keyboard/responsive pass in Chrome (Playwright):** tab to the toggle and activate via keyboard; row actions reachable; table horizontally scrolls at 360px width on one pilot tab.
- [ ] **Step 5: Confirm no new architecture:** `git diff --stat` shows changes only in the files listed in Tasks 1–6 plus their tests; no new `shared/` directory was created.
