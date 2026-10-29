# Organization Workspace & Navigation Consolidation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Organization Workspace the single source of truth for org-scoped functionality; remove nav/route/page/logic duplicates from the left sidebar and standalone pages.

**Architecture:** Delete-only consolidation. Sidebar becomes global-only (drop 7 org-scoped entries); 6 standalone list routes redirect into workspace `?tab=`; the access module's rich sections replace the workspace's 3 lightweight RBAC tabs; `/access*` and `/organizations/:id/access*` redirect into the workspace; dead pages deleted after consumption cleanup.

**Tech Stack:** React Router 7 (`PreserveQueryRedirect` pattern), React 19, existing `@/modules/access` + `@/modules/organization` modules; vitest + playwright.

**Spec:** `docs/superpowers/specs/2026-10-05-org-nav-consolidation-design.md`

## Global Constraints

- Audit first: do not delete anything a workspace tab still imports. Shared hooks (`useOrganizationData.ts`) are used by BOTH pages and tabs — the pages die, the hooks stay.
- Deep links never 404: `/people` `/departments` `/teams` `/offices` `/clients` `/vendors` `/access` `/access/:section` `/organizations/:orgId/access` `/organizations/:orgId/access/:section` all render redirects to workspace `?tab=`. Detail/form/create routes (`/:entity/:id`, `/new`, `/:id/edit`) stay untouched.
- Permissions: sidebar gating and workspace tab gating unchanged except dropping role-label shortcuts that bypass `evaluateUserPermission` (matches prior strict-superuser ruling); `isUserAdmin` gate for `testing` stays.
- No new components: redirects reuse the existing `PreserveQueryRedirect` pattern (see `src/routes/PreserveQueryRedirect.tsx`); access tabs reuse `src/modules/access/components/*Section.tsx`.
- Verification per task: `pnpm vitest run <scope>` → `pnpm vitest run` → `pnpm exec tsc --noEmit` → `pnpm build`; e2e updates use the existing `loginAs` harness pattern.

## Review Focus

- An internal link to a removed route from a non-router surface (breadcrumbs, palette actions, tests) — every `'/people'/'/access'`-class literal must resolve through the redirect or be updated; a silent 404 breaks history navigation.
- An org-scoped page failing to re-scope after org switch because the sidebar now has fewer entries but the workspace tab-render guard never re-keys (`TabContentTransition` keys by `activeTab`; if a tab component caches `org.id` at mount it must re-mount or accept `key={activeTab}:${org.id}`).
- Access section tab-id collision between the workspace top-level `overview`, `projects`, `activity` and the access module's same-named sections — unique tab ids for access (`access-overview`, `access-users`, `access-projects`, `access-simulator`, `access-audit`) keep the workspace top section untouched.
- Legacy `/access` deep links from palette/tests that decode to a stale target after routes are replaced — the redirect component must translate them, not hand them over broken.
- A workspace tab page mounting an access module component that needs props the tab signature doesn't pass (e.g. `org` shape differences between `PeopleTab` and `AccessOverviewSection`) — interfaces must match at the render branch.

---

### Task 1: Sidebar pruning + org-scoped list-route redirects

**Files:**
- Modify: `src/layouts/Sidebar.tsx:97-171` (drop org-scoped entries; tighten gate)
- Modify: `src/routes/AppRoutes.tsx` (list routes → redirects; keep detail/form/create)
- Create: `src/routes/OrgWorkspaceRedirect.tsx`
- Test: `src/routes/__tests__/OrgWorkspaceRedirect.test.tsx` (new)

**Interfaces:**
- Consumes: `useOrganization().currentOrganization.id`, existing `PreserveQueryRedirect`.
- Produces: `<OrgWorkspaceRedirect tab={...}/>` rendering `<Navigate to={`/organizations/${currentOrganization.id}?tab=${tab}`} replace />` with `?tab` preserved for deep links via existing wrapper. Available: `OrgWorkspaceRedirect` import.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/routes/__tests__/OrgWorkspaceRedirect.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { OrgWorkspaceRedirect } from '../OrgWorkspaceRedirect';

const orgSpy = vi.fn();
vi.mock('@/core/organization/useOrganization', () => ({
  useOrganization: () => orgSpy(),
}));

function DeepLink() {
  const { pathname, search } = useLocation();
  return <div data-testid="loc">{`${pathname}${search}`}</div>;
}

describe('OrgWorkspaceRedirect', () => {
  it('redirects a list route into the org workspace with tab', async () => {
    orgSpy.mockReturnValue({ currentOrganization: { id: 'org-1', code: 'APEX' } });
    render(
      <MemoryRouter initialEntries={['/people']}>
        <Routes>
          <Route path="/people" element={<OrgWorkspaceRedirect tab="people" />} />
          <Route path="/organizations/:id" element={<DeepLink />} />
        </Routes>
      </MemoryRouter>,
    );
    expect((await screen.findByTestId('loc')).textContent).toBe('/organizations/org-1?tab=people');
  });

  it('denies render when no org is selected (no navigation loop)', async () => {
    orgSpy.mockReturnValue({ currentOrganization: null });
    render(
      <MemoryRouter initialEntries={['/teams']}>
        <Routes>
          <Route path="/teams" element={<OrgWorkspaceRedirect tab="teams" />} />
          <Route path="/organizations/:id" element={<DeepLink />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('loc')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/routes/__tests__/OrgWorkspaceRedirect.test.tsx`
Expected: FAIL (`OrgWorkspaceRedirect` does not exist).

- [ ] **Step 3: Implement redirect component**

```tsx
// src/routes/OrgWorkspaceRedirect.tsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useOrganization } from '@/core/organization/useOrganization';

export const OrgWorkspaceRedirect: React.FC<{ tab: string }> = ({ tab }) => {
  const { search, hash } = useLocation();
  const { currentOrganization } = useOrganization();
  if (!currentOrganization?.id) return null;
  return <Navigate to={`/organizations/${currentOrganization.id}?tab=${tab}${search}${hash}`} replace />;
};
```

Replace each corresponding `<Route path="/people" ... />` etc. with `<Route path="/people" element={<OrgWorkspaceRedirect tab="people" />} />` (and `departments/teams/offices/clients/vendors` the same); leave `/people/new`, `/people/:id`, `/people/:id/edit` etc. untouched.

Sidebar: remove `Access & RBAC/Clients/Vendors/People/Departments/Teams/Offices` entries from the ORGANIZATION section; keep only `Organizations` (global list). Change the `isItemAllowed` blanket — drop `user.is_superuser || role === 'Platform Admin'` short-circuit and the Organization Owner blanket pass; evaluate `pagePermission`/`permissions` for every item (strict-ruling alignment), keep `testing` gated by `isUserAdmin`.

- [ ] **Step 4: Run tests + build**

Run: `pnpm vitest run src/routes src/layouts && pnpm exec tsc --noEmit && pnpm exec playwright test e2e/org-access.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/layouts/Sidebar.tsx src/routes/AppRoutes.tsx src/routes/OrgWorkspaceRedirect.tsx src/routes/__tests__/OrgWorkspaceRedirect.test.tsx
git commit -m "refactor(nav): prune org-scoped sidebar, redirect list routes to workspace"
```

### Task 2: Enrich Access workspace section, adopt access module components

**Files:**
- Modify: `src/modules/organization/pages/OrganizationWorkspacePage.tsx` (Access section tab defs + render branches)
- Create: none
- Test: `src/modules/organization/pages/__tests__/OrganizationWorkspaceAccessTabs.test.tsx` (new)

**Interfaces:**
- Consumes: `src/modules/access/components/{AccessOverviewSection,UserAccessSection,RolesWorkspaceSection,GroupsManagementSection,PermissionsCatalogSection,ProjectAccessSection,PermissionSimulatorSection,AccessAuditSection}.tsx`; existing `AccessWorkspaceTab`-style permission keys match workspace permission ids.
- Produces: workspace Access & RBAC section tabs in this order/ids: `overview` (workspace org overview — keep), `roles`, `groups`, `permissions`, `users`, `access-projects`, `access-simulator`, `access-audit`. Legacy section→tab map: `overview→roles`, `users→users`, `roles→roles`, `groups→groups`, `permissions→permissions`, `projects→access-projects`, `simulator→access-simulator`, `audit→access-audit`.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/modules/organization/pages/__tests__/OrganizationWorkspaceAccessTabs.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../core/organization/useOrganization', () => ({
  useOrganization: () => ({ currentOrganization: { id: 'org-1' } }),
}));
// then render OrganizationWorkspacePage at /organizations/org-1?tab=permissions
// and expect the access PermissionsCatalogSection marker (e.g. testid present
// in module source) to be in the document.
```

(Verify the real section marker from `src/modules/access/components/PermissionsCatalogSection.tsx` before writing; do not invent.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/modules/organization/pages/__tests__/OrganizationWorkspaceAccessTabs.test.tsx`
Expected: FAIL (old lightweight PermissionsTab lacks the marker).

- [ ] **Step 3: Implement the workspace swaps**

Substitute rich access-module sections for `RolesTab`, `PermissionsTab`, `GroupsTab` render branches; add branches for `users/access-projects/access-simulator/access-audit` rendering `UserAccessSection`, `ProjectAccessSection`, `PermissionSimulatorSection`, `AccessAuditSection`. Extend `WORKSPACE_SECTIONS[access]` tabs accordingly with their permission ids (match the module's `ACCESS_TABS` permissions: `security.view`, `people.view`, `roles.view`, `group.view`, `security.view`, `project.view`, `permissions.manage`, `audit.view`).

- [ ] **Step 4: Run + typecheck**

Run: `pnpm vitest run src/modules/organization && pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/organization/pages/OrganizationWorkspacePage.tsx src/modules/organization/pages/__tests__/OrganizationWorkspaceAccessTabs.test.tsx
git commit -m "refactor(workspace): adopt access module sections as Access & RBAC tabs"
```

### Task 3: Drop `/access*` + `/organizations/:id/access*` routes, remove dead pages

**Files:**
- Modify: `src/routes/AppRoutes.tsx` (replace `/access`, `/access/:section`, `/organizations/:organizationId/access`, `/organizations/:organizationId/access/:section` with redirects into `?tab=` map from Task 2)
- Delete: `src/modules/access/pages/AccessWorkspacePage.tsx`
- Delete: `src/modules/organization/pages/{PeoplePage,DepartmentsPage,TeamsPage,OfficesPage,ClientsPage,VendorsPage}.tsx`
- Modify: `src/modules/organization/components/tabs/{RolesTab,GroupsTab,PermissionsTab}.tsx` (deleted once no implicit workspace imports remain; verify by grep first)
- Test: extend `src/routes/__tests__/OrgWorkspaceRedirect.test.tsx` with `/access` mapping cases

**Interfaces:**
- Consumes: `PreserveQueryRedirect` for static targets, tab-map for legacy access sections.
- Produces: canonical `/organizations/:id?tab=*` only.

- [ ] **Step 1: Write failing tests for the legacy access routes**

```tsx
it.each([
  ['/access', '/organizations/org-1?tab=roles'],
  ['/access/projects', '/organizations/org-1?tab=access-projects'],
  ['/organizations/org-1/access', '/organizations/org-1?tab=roles'],
  ['/organizations/org-1/access/audit', '/organizations/org-1?tab=access-audit'],
])('redirects %s to %s', (from, to) => {
  orgSpy.mockReturnValue({ currentOrganization: { id: 'org-1' } });
  // render MemoryRouter initialEntries={[from]} expecting DeepLink css at to
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm vitest run src/routes/__tests__/OrgWorkspaceRedirect.test.tsx`
Expected: FAIL (routes still render AccessWorkspacePage).

- [ ] **Step 3: Implement redirects + dead-code deletion**

Replace access routes with redirects per map. Delete the pages listed above; grep that no other file imports them (`grep -rl "modules/access/pages/AccessWorkspacePage\|PeoplePage\|DepartmentsPage\|TeamsPage\|OfficesPage\|ClientsPage\|VendorsPage" src/ e2e/`); for any remaining importer left in the search/palette/workspace action surfaces (e.g. `OrganizationWorkspacePage.tsx`'s own "Access Workspace" button navigating to `/organizations/${org.id}/access/:target`), repoint them to `?tab=` targets instead of deleting neighboring logic.

- [ ] **Step 4: Run all suites**

Run: `pnpm vitest run && pnpm exec tsc --noEmit && pnpm build && pnpm exec playwright test e2e/org-access.spec.ts e2e/organization-isolation.spec.ts e2e/route-authorization.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/AppRoutes.tsx src/modules/access src/modules/organization
git commit -m "refactor(access): consolidate RBAC into workspace, drop duplicates"
```

### Task 4: Audit doc + housekeeping

**Files:**
- Create: `docs/frontend/ORGANIZATION_NAVIGATION_AUDIT.md`
- Modify as needed: any leftover test imports of deleted pages

**Interfaces:**
- Consumes: Tasks 1-3 actual file deletions, sidebar diff.
- Produces: the migration matrix doc required by spec §6; CI-clean run.

- [ ] **Step 1: Write the audit doc with before/after inventory + migration matrix from the realized diff** (list each removed route/page, each sidebar entry removed, each component deleted, and each redirect mapping — copy from the committed diffs, never from memory).
- [ ] **Step 2: Run final verification**

Run: `pnpm vitest run && pnpm exec tsc --noEmit && pnpm build && pnpm exec playwright test e2e/`
Expected: all green (document any pre-existing failure explicitly).

- [ ] **Step 3: Commit**

```bash
git add docs/frontend/ORGANIZATION_NAVIGATION_AUDIT.md
git commit -m "docs: organization navigation consolidation audit"
```
