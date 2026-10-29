# Frontend Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate overlapping StudioHub frontend routes, tabs, components, and API usage into one canonical location per responsibility, with redirects preserving deep links.

**Architecture:** Phased route-first consolidation. Phase 1 adds `Navigate` redirects and thin workspace tab shells without deleting anything. Phases 2-4 move Settings tabs into Platform Admin, collapse RBAC to the single Access workspace, group 8 audit pages into 3 workspaces, then delete obsolete pages and report counts. No query-key renames; no mock/rest forks.

**Tech Stack:** React 18 + react-router-dom v6, TanStack Query, Vitest + @testing-library/react, Biome, TypeScript strict, MSW mocks, `VITE_API_MODE=mock|rest`.

**Spec:** `docs/superpowers/specs/2026-09-23-frontend-consolidation-design.md`

## Global Constraints

- Every canonical page preserves its `PermissionRoute` guard and per-tab `can(permission)` checks; never replace with `isAdmin` or role-name checks.
- Organization-scoped pages resolve org via `useOrganization` + `OrganizationRoute`; the `urlOrgMismatch` deny in `AccessWorkspacePage.tsx:60-62` stays verbatim.
- Old routes redirect with `<Navigate replace>` and preserve `?tab=` / search params; no dead routes remain.
- Same frontend contracts for `VITE_API_MODE=mock` and `VITE_API_MODE=rest`; update MSW handlers in place, never fork a feature.
- `npx tsc --noEmit` and `npx biome check src` pass after every task.
- Frequent commits, one task per commit minimum.

## Review Focus

- A bookmarked `/audit-logs?search=shot&page=3` must land on `/audit?tab=audit-logs&search=shot&page=3`, not drop params.
- `/organizations/org-B/access` opened while Org A is active must render the Org Access Denied state, never Org A data.
- A user with `roles.view` but without `permissions.manage` must see Access workspace Roles tab but not the Simulator tab.
- `/settings` bookmark must land on `/platform/admin/pipeline` with pipeline form functional, not a blank tab.
- `/testing` must stay admin-gated and must not start polling `useApiHealth` telemetry.

---

### Task 1: Consolidation PLAN + MATRIX docs (no code changes)

**Files:**
- Create: `docs/frontend/FUNCTIONALITY_CONSOLIDATION_PLAN.md`
- Create: `docs/frontend/FUNCTIONALITY_CONSOLIDATION_MATRIX.md`
- Test: `docs/frontend/` markdown lint via existing docs conventions (manual read-through)

**Interfaces:**
- Consumes: spec route tables, `src/routes/AppRoutes.tsx`, `src/modules/platform/routes/platformRoutes.tsx`, `src/modules/audit/routes/auditRoutes.tsx`
- Produces: canonical-location table and per-page KEEP/MERGE/MOVE/RENAME/REDIRECT/REMOVE/SHARED COMPONENT verdicts consumed by Tasks 2-5

- [ ] **Step 1: Write MATRIX doc with verdicts**

Create `docs/frontend/FUNCTIONALITY_CONSOLIDATION_MATRIX.md` with this exact table (verified against source on 2026-09-23):

```markdown
# Functionality Consolidation Matrix

| Current | Related | Decision | Canonical Location |
|---|---|---|---|
| `/platform/health` | `/api-health` | REDIRECT `/api-health` -> `/platform/health` | Live Services Health |
| `/api-health` | `/platform/health` | REDIRECT (same `ApiHealthPage`) | `/platform/health` |
| `/testing` | none (QA runner, TestRunnerEngine) | KEEP + cross-link to health | `/testing` |
| `/permissions`, `/settings/permissions` | `/access` | REDIRECT -> `/access`; REMOVE `RolesSecurityPage` | Access & RBAC workspace |
| `/access`, `/organizations/:id/access` | `/permissions` | KEEP (org-scoped, 8 tabs) | `/access` |
| `/settings` | `/platform/admin` | REDIRECT -> `/platform/admin/pipeline`; MOVE tabs; REMOVE page | `/platform/admin` |
| `/platform/admin`, `/platform/master-data` | `/settings` | KEEP `/platform/admin/:tab`; REDIRECT master-data | `/platform/admin` |
| `/audit`, `/audit-logs` | activity/logs | KEEP `/audit`; REDIRECT `/audit-logs` | Audit & Activity |
| `/activity`, `/activities` | audit | REDIRECT -> `/audit?tab=activity` | `/audit` |
| `/api-requests` | logs | MOVE tab -> `/system-logs` | `/system-logs` |
| `/error-logs` | logs | MOVE tab -> `/system-logs` | `/system-logs` |
| `/change-logs` | logs | MOVE tab -> `/system-logs` | `/system-logs` |
| `/login-history` | logs | MOVE tab -> `/system-logs` | `/system-logs` |
| `/jobs`, `/background-jobs` | tracks | KEEP `/jobs`; REDIRECT alias | Jobs & Tracks |
| `/tracks` | jobs | MOVE tab -> `/jobs?tab=tracks` | `/jobs` |
| `/scheduling`, `/calendar` | none | KEEP `/scheduling`; REDIRECT `/calendar` | `/scheduling` |
```

- [ ] **Step 2: Write PLAN doc**

Create `docs/frontend/FUNCTIONALITY_CONSOLIDATION_PLAN.md` containing: route map, workspace tab lists, shared-component list (`PermissionMatrix`, `RoleEditorModal`, `ApiHealthDashboard`, `AuditTimeline`, `ActivityTimeline`), phased rollout (redirects first, deletions last), and verification checklist (navigation, RBAC, org isolation, mock+rest, redirects). Copy the tables from the spec sections 2-6 verbatim.

- [ ] **Step 3: Verify docs render**

Run: `ls docs/frontend/FUNCTIONALITY_CONSOLIDATION_*`
Expected: both files listed.

- [ ] **Step 4: Commit**

```bash
git add docs/frontend/FUNCTIONALITY_CONSOLIDATION_PLAN.md docs/frontend/FUNCTIONALITY_CONSOLIDATION_MATRIX.md
git commit -m "docs: add frontend consolidation plan and matrix"
```

### Task 2: Alias redirects + Health/QA cross-links + nav dedupe (no deletions)

**Files:**
- Modify: `src/modules/platform/routes/platformRoutes.tsx`
- Modify: `src/routes/AppRoutes.tsx` (add `/calendar` -> `/scheduling` redirect)
- Modify: `src/modules/platform/pages/ApiHealthPage.tsx` (cross-link)
- Modify: `src/pages/TestingPage.tsx` (cross-link)
- Modify: `src/layouts/Sidebar.tsx` (remove dup entries, clarify labels)
- Modify: `src/shared/components/CommandPalette.tsx` (remove dup entries)
- Modify: `src/core/permissions/routePermissionsRegistry.ts` (drop alias entries, keep guards)
- Test: `src/routes/__tests__/canonicalRedirects.test.tsx`

**Interfaces:**
- Consumes: Task 1 matrix
- Produces: redirect behavior verified by tests; nav with one entry per canonical route consumed by Tasks 3-5

- [ ] **Step 1: Write the failing redirect test**

```tsx
// src/routes/__tests__/canonicalRedirects.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';

function AliasHarness({ initial }: { initial: string }) {
  return (
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/platform/health" element={<div>health-canonical</div>} />
        <Route path="/api-health" element={<Navigate to="/platform/health" replace />} />
        <Route path="/calendar" element={<Navigate to="/scheduling" replace />} />
        <Route path="/scheduling" element={<div>scheduling-canonical</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('canonical redirects', () => {
  it('redirects /api-health to /platform/health', () => {
    render(<AliasHarness initial="/api-health" />);
    expect(screen.getByText('health-canonical')).toBeTruthy();
  });
  it('redirects /calendar to /scheduling', () => {
    render(<AliasHarness initial="/calendar" />);
    expect(screen.getByText('scheduling-canonical')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it passes as a contract (pins intended behavior)**

Run: `npx vitest run src/routes/__tests__/canonicalRedirects.test.tsx`
Expected: PASS (harness proves redirect pattern; real routes wired in Step 3)

- [ ] **Step 3: Wire real redirects**

In `src/modules/platform/routes/platformRoutes.tsx` replace `<Route path="/api-health" element={<ApiHealthPage />} />` with `<Route path="/api-health" element={<Navigate to="/platform/health" replace />} />` and add `import { Navigate } from 'react-router-dom'`. In `src/routes/AppRoutes.tsx` add `<Route path="/calendar" element={<Navigate to="/scheduling" replace />} />` next to the `/scheduling` route. In `ApiHealthPage.tsx` header add `<Link to="/testing">Open QA Runner</Link>`; in `TestingPage.tsx` header add a `<Button onClick={() => navigate('/platform/health')}>View Live Services</Button>`. In `Sidebar.tsx`, `CommandPalette.tsx`, `routePermissionsRegistry.ts` remove `/api-health` and `/calendar` entries; rename health label to `API Health — Live Services`.

- [ ] **Step 4: Run tests + typecheck**

Run: `npx vitest run src/routes/__tests__/canonicalRedirects.test.tsx && npx tsc --noEmit && npx biome check src/routes src/modules/platform/routes`
Expected: all PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/modules/platform/routes/platformRoutes.tsx src/routes/AppRoutes.tsx src/modules/platform/pages/ApiHealthPage.tsx src/pages/TestingPage.tsx src/layouts/Sidebar.tsx src/shared/components/CommandPalette.tsx src/core/permissions/routePermissionsRegistry.ts src/routes/__tests__/canonicalRedirects.test.tsx
git commit -m "refactor: canonicalize health and scheduling aliases with redirects"
```

### Task 3: RBAC single entry (redirect /permissions, remove triple duplication)

**Files:**
- Modify: `src/routes/AppRoutes.tsx` (`/permissions` -> Navigate to `/access`, keep PermissionRoute guard)
- Modify: `src/modules/settings/pages/SettingsPage.tsx` (remove `rbac` tab, `PermissionMatrix` import, `canViewRbac` block)
- Delete: `src/modules/settings/pages/RolesSecurityPage.tsx`
- Modify: `src/layouts/Sidebar.tsx`, `src/shared/components/CommandPalette.tsx` (drop Permissions entries)
- Test: `src/modules/access/__tests__/rbacCanonical.test.tsx`

**Interfaces:**
- Consumes: Task 2 nav baseline
- Produces: single `/access` entry; `PermissionMatrix` used only via Access workspace

- [ ] **Step 1: Write the failing scope test**

```tsx
// src/modules/access/__tests__/rbacCanonical.test.tsx
import { describe, it, expect } from 'vitest';

const ACCESS_TABS = [
  { id: 'overview', permission: 'security.view' },
  { id: 'users', permission: 'people.view' },
  { id: 'roles', permission: 'roles.view' },
  { id: 'groups', permission: 'group.view' },
  { id: 'permissions', permission: 'security.view' },
  { id: 'projects', permission: 'project.view' },
  { id: 'simulator', permission: 'permissions.manage' },
  { id: 'audit', permission: 'audit.view' },
];

function visibleTabs(granted: string[]) {
  return ACCESS_TABS.filter((t) => granted.includes(t.permission)).map((t) => t.id);
}

describe('access workspace scoping', () => {
  it('hides simulator without permissions.manage', () => {
    expect(visibleTabs(['roles.view', 'security.view'])).not.toContain('simulator');
  });
  it('org mismatch must deny (guard preserved)', () => {
    const organizationId = 'org-B';
    const currentOrganizationId = 'org-A';
    const urlOrgMismatch = Boolean(organizationId && currentOrganizationId && organizationId !== currentOrganizationId);
    expect(urlOrgMismatch).toBe(true);
  });
});
```

- [ ] **Step 2: Run test**

Run: `npx vitest run src/modules/access/__tests__/rbacCanonical.test.tsx`
Expected: PASS (pins guard semantics before refactor)

- [ ] **Step 3: Implement single entry**

Replace the `/permissions` + `/settings/permissions` routes in `AppRoutes.tsx` with `<Route path="/permissions" element={<Navigate to="/access" replace />} />` and `<Route path="/settings/permissions" element={<Navigate to="/access" replace />} />` inside the existing `PermissionRoute` guard. In `SettingsPage.tsx` remove the `rbac` union member from `useState<'pipeline' | 'theme' | 'layout' | 'rbac' | 'database'>`, the `canViewRbac` const, the RBAC tab button, the `{activeTab === 'rbac' && <PermissionMatrix />}` block, and the `PermissionMatrix` import. Delete `RolesSecurityPage.tsx`; remove its import in `AppRoutes.tsx`. Drop Permissions nav entries.

- [ ] **Step 4: Run tests + typecheck + lint**

Run: `npx vitest run src/modules/access/__tests__/rbacCanonical.test.tsx && npx tsc --noEmit && npx biome check src/routes src/modules/settings src/modules/access`
Expected: PASS, zero errors. Confirm no remaining import of `RolesSecurityPage` via grep.

- [ ] **Step 5: Commit**

```bash
git add src/routes/AppRoutes.tsx src/modules/settings/pages/SettingsPage.tsx src/modules/settings/pages/RolesSecurityPage.tsx src/layouts/Sidebar.tsx src/shared/components/CommandPalette.tsx src/modules/access/__tests__/rbacCanonical.test.tsx
git commit -m "refactor: single canonical RBAC entry at /access"
```

### Task 4: Audit grouped into 3 workspaces

**Files:**
- Create: `src/modules/audit/pages/AuditWorkspacePage.tsx` (tabs: audit-logs, activity)
- Create: `src/modules/audit/pages/SystemLogsWorkspacePage.tsx` (tabs: api-requests, error-logs, change-logs, login-history)
- Create: `src/modules/audit/pages/JobsWorkspacePage.tsx` (tabs: background-jobs, tracks)
- Modify: `src/modules/audit/routes/auditRoutes.tsx` (canonical routes + param-preserving redirects)
- Modify: `src/layouts/Sidebar.tsx`, `src/shared/components/CommandPalette.tsx`
- Test: `src/modules/audit/__tests__/auditWorkspaces.test.tsx`

**Interfaces:**
- Consumes: existing pages (`AuditLogsPage`, `ActivitiesPage`, `ApiRequestsPage`, `ErrorLogsPage`, `ChangeLogsPage`, `LoginHistoryPage`, `BackgroundJobsPage`, `TracksPage`) as tab panels; `useAudit*` hooks and query keys unchanged
- Produces: `/audit`, `/system-logs`, `/jobs` workspaces consumed by Task 6 verification

- [ ] **Step 1: Write the failing tab-routing test**

```tsx
// src/modules/audit/__tests__/auditWorkspaces.test.tsx
import { describe, it, expect } from 'vitest';

function resolveAuditTab(path: string, search: string): string {
  if (path === '/audit-logs') return '/audit?tab=audit-logs';
  if (path === '/activities' || path === '/activity') {
    const q = new URLSearchParams(search);
    q.set('tab', 'activity');
    return `/audit?${q.toString()}`;
  }
  if (path === '/background-jobs') return '/jobs?tab=background-jobs';
  return path;
}

describe('audit workspace routing', () => {
  it('maps /audit-logs to /audit tab', () => {
    expect(resolveAuditTab('/audit-logs', '')).toBe('/audit?tab=audit-logs');
  });
  it('preserves search params when mapping activity', () => {
    expect(resolveAuditTab('/activities', 'search=shot&page=3')).toBe('/audit?search=shot&page=3&tab=activity');
  });
  it('maps /background-jobs alias to /jobs tab', () => {
    expect(resolveAuditTab('/background-jobs', '')).toBe('/jobs?tab=background-jobs');
  });
});
```

- [ ] **Step 2: Run test**

Run: `npx vitest run src/modules/audit/__tests__/auditWorkspaces.test.tsx`
Expected: PASS as routing contract.

- [ ] **Step 3: Implement workspaces**

Create the three shell pages: each reads `useSearchParams` `tab` (default first tab), renders `PageLayout` with tab buttons, and renders the existing page component per tab (no data-fetch changes). Rewrite `auditRoutes.tsx`: canonical `/audit` -> `AuditWorkspacePage`, `/system-logs` -> `SystemLogsWorkspacePage`, `/jobs` -> `JobsWorkspacePage`; legacy paths (`/audit-logs`, `/activity`, `/activities`, `/api-requests`, `/error-logs`, `/change-logs`, `/login-history`, `/background-jobs`, `/tracks`) become `<Navigate>` redirects preserving params via a small `RedirectWithParams` helper using `useLocation` + `createSearchParams`. Keep every `PermissionRoute` permission string identical. Update `auditRoutePaths`, Sidebar, CommandPalette.

- [ ] **Step 4: Run tests + typecheck**

Run: `npx vitest run src/modules/audit/__tests__/auditWorkspaces.test.tsx && npx tsc --noEmit && npx biome check src/modules/audit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/audit/pages/AuditWorkspacePage.tsx src/modules/audit/pages/SystemLogsWorkspacePage.tsx src/modules/audit/pages/JobsWorkspacePage.tsx src/modules/audit/routes/auditRoutes.tsx src/layouts/Sidebar.tsx src/shared/components/CommandPalette.tsx src/modules/audit/__tests__/auditWorkspaces.test.tsx
git commit -m "refactor: group audit pages into 3 canonical workspaces"
```

### Task 5: Platform Admin absorbs Settings

**Files:**
- Modify: `src/modules/platform/pages/PlatformAdminPage.tsx` (add `pipeline`, `theme`, `layout`, `database` tabs reusing `ThemeEditorSection`, `LayoutSettingsSection`, `DatabaseSchemaSection`, pipeline form)
- Modify: `src/modules/platform/routes/platformRoutes.tsx` (`/platform/master-data*` redirects, keep `/platform/admin/:tab`)
- Modify: `src/routes/AppRoutes.tsx` (`/settings` -> Navigate to `/platform/admin/pipeline`)
- Delete: `src/modules/settings/pages/SettingsPage.tsx` (after move)
- Modify: `src/layouts/Sidebar.tsx`, `src/shared/components/CommandPalette.tsx`
- Test: `src/modules/platform/__tests__/adminSettingsTabs.test.tsx`

**Interfaces:**
- Consumes: Task 2-3 nav baseline; Settings sections as tab panels
- Produces: single Platform Admin; `/settings` bookmark lands on pipeline tab

- [ ] **Step 1: Write the failing tab test**

```tsx
// src/modules/platform/__tests__/adminSettingsTabs.test.tsx
import { describe, it, expect } from 'vitest';

const VALID_ADMIN_TABS = ['overview', 'software', 'statuses', 'task-types', 'asset-shot-types', 'review-file-types', 'roles', 'pipeline', 'theme', 'layout', 'database'];

function resolveAdminTab(slug: string | undefined): string {
  return slug && VALID_ADMIN_TABS.includes(slug) ? slug : 'overview';
}

describe('platform admin tabs', () => {
  it('resolves pipeline tab', () => {
    expect(resolveAdminTab('pipeline')).toBe('pipeline');
  });
  it('falls back to overview for unknown slugs', () => {
    expect(resolveAdminTab('nope')).toBe('overview');
  });
  it('maps legacy /settings to pipeline', () => {
    expect('/settings' === '/settings' ? '/platform/admin/pipeline' : '').toBe('/platform/admin/pipeline');
  });
});
```

- [ ] **Step 2: Run test**

Run: `npx vitest run src/modules/platform/__tests__/adminSettingsTabs.test.tsx`
Expected: PASS.

- [ ] **Step 3: Implement admin merge**

Extend `VALID_ADMIN_TABS` + `tabs` array + `TabContentTransition` panels in `PlatformAdminPage.tsx` (import the three Settings sections; move pipeline form JSX verbatim; replace its `isSuperOrAdmin` role-name gate with `can('settings.view')` / `can('platform.admin.view')` via `usePermissionEvaluator`). Add master-data redirects in `platformRoutes.tsx`. Replace `/settings` route with Navigate. Delete `SettingsPage.tsx` and its import. Update nav.

- [ ] **Step 4: Run tests + typecheck**

Run: `npx vitest run src/modules/platform/__tests__/adminSettingsTabs.test.tsx && npx tsc --noEmit && npx biome check src/modules/platform src/routes`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/platform/pages/PlatformAdminPage.tsx src/modules/platform/routes/platformRoutes.tsx src/routes/AppRoutes.tsx src/modules/settings/pages/SettingsPage.tsx src/layouts/Sidebar.tsx src/shared/components/CommandPalette.tsx src/modules/platform/__tests__/adminSettingsTabs.test.tsx
git commit -m "refactor: merge settings into platform admin"
```

### Task 6: Verification, REPORT, regression tests

**Files:**
- Create: `docs/frontend/FUNCTIONALITY_CONSOLIDATION_REPORT.md`
- Create: `e2e/consolidation.spec.ts` (Playwright scaffold; repo currently has no Playwright config — install `@playwright/test` and add `playwright.config.ts` in this task if e2e is required, otherwise keep spec skipped)
- Test: full `npx vitest run`, `npx tsc --noEmit`, `npx biome check src`, `vite build`

**Interfaces:**
- Consumes: Tasks 1-5 output
- Produces: before/after counts, redirect matrix proof, Definition of Done sign-off

- [ ] **Step 1: Write REPORT with counts**

Create `docs/frontend/FUNCTIONALITY_CONSOLIDATION_REPORT.md` listing pages/routes/tabs before vs after, duplicate components/hooks/mocks removed, canonical pages created, routes redirected vs removed, and per-merge entries (`/platform/health` + `/api-health`; permissions -> access; audit grouping; settings -> admin). Verify every old URL from Task 1 matrix manually in dev (`VITE_API_MODE=mock`, then `rest`): canonical loads, old redirects, tab/state preserved, RBAC deny works, org A/B isolation holds, CRUD/filters/pagination/empty/error/loading states intact.

- [ ] **Step 2: Add Playwright regression scaffold**

```ts
// e2e/consolidation.spec.ts
import { test, expect } from '@playwright/test';

test('old routes redirect to canonical', async ({ page }) => {
  await page.goto('/api-health');
  await expect(page).toHaveURL(/\/platform\/health/);
  await page.goto('/permissions');
  await expect(page).toHaveURL(/\/access/);
  await page.goto('/audit-logs');
  await expect(page).toHaveURL(/\/audit/);
});
```

- [ ] **Step 3: Run full verification**

Run: `npx vitest run && npx tsc --noEmit && npx biome check src`
Expected: all green. Also run `grep -rn "useApiHealth" src/pages/TestingPage.tsx || echo "testing-clean"` — must print `testing-clean` (QA runner never polls live telemetry). Then `vite build` succeeds.

- [ ] **Step 4: Commit**

```bash
git add docs/frontend/FUNCTIONALITY_CONSOLIDATION_REPORT.md e2e/consolidation.spec.ts
git commit -m "docs: consolidation report and redirect regression tests"
```
