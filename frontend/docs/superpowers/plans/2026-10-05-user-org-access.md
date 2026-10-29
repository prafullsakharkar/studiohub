# User-Specific Organization Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce strict user-specific organization access (superuser → all orgs, others → explicit memberships only) across Django APIs and the React shell.

**Architecture:** Audit-and-harden on ADR-0033: tighten the single `isPlatformSuperuser` choke point, audit every org-scoped backend endpoint and every frontend surface, add IDOR + scoping tests. No new permission system.

**Tech Stack:** Django REST Framework (`uv run`), React 19 + TanStack Query + existing `OrganizationContext`/rbac (`pnpm`)

**Spec:** `docs/superpowers/specs/2026-10-05-user-specific-org-access-design.md`

## Global Constraints

- Backend is authoritative: every org/project-scoped API enforces membership; never trust org UUIDs from URL/body/query, localStorage, or frontend state.
- Strict superuser-only: ONLY `user.is_superuser === true` grants all-org access; `is_staff` and `Platform Admin`/`Super Admin` role labels grant nothing by themselves.
- No fetch-all-filter-in-React: list/search APIs return permission-scoped querysets; the frontend consumes the server-filtered directory.
- No duplicate authorization system: reuse selectors, `permission_map`, `OrganizationContextMixin`, `HasPermission`, `has_organization_access`, `checkUserHasOrgAccess`, `filterAccessibleOrganizations`, `isPlatformSuperuser`.
- Single-org rule: exactly 1 accessible org → no dropdown, org locked post-auth, details load; 0 orgs → empty state, never an arbitrary org.
- Backend commands run with `uv run`; frontend verifies with `pnpm exec tsc --noEmit`, `pnpm vitest run`, `pnpm build` (note: `pnpm lint` IS tsc; there is NO `test:e2e` script — E2E runs via `pnpm exec playwright test`).

## Review Focus

- A `Platform Admin` role-labeled non-superuser silently retaining all-org access through an un-tightened caller — every `isSuperAdminUser`/`is_staff` use must resolve to `is_superuser`.
- A search/autocomplete endpoint returning cross-org rows that the UI then displays — every search must be org-scoped server-side.
- A persisted `studiohub_active_org_id` (or favorite/recent id) resurrecting an org the user lost access to — boot validation must demote to first-permitted or empty state.
- An org switch leaving a stale project/search/dashboard keyed without org+user scope — all dependent queries must re-key and refetch.
- A version/environment label hardcoding values instead of reading the version/configuration mechanism — header must show live values.

---

### Task 1: Backend — strict superuser audit on org/project querysets

**Files:**
- Modify: `../studiohub/backend/apps/organization/api/viewsets/organization.py:74-95` (verify, likely no change)
- Modify: any org/project-scoped viewset/selector found using `is_staff` or role labels as an all-access bypass (audit targets: `backend/apps/organization/selectors/*.py`, `backend/apps/organization/api/viewsets/*.py`, `backend/apps/production/` project querysets, `backend/apps/organization/api/urls_legacy.py:112`)
- Test: `../studiohub/backend/apps/organization/tests/api/viewsets/test_org_access_scope.py` (new)

**Interfaces:**
- Consumes: `request.user.is_superuser`, `OrganizationMembership` (`user`, `organization`, `is_deleted=False`), existing `permission_map`/`HasPermission`.
- Produces: unchanged response shapes; list endpoints return scoped querysets; unauthorized detail access → 403/404 per endpoint convention.

- [ ] **Step 1: Audit for bypasses**

Run: `grep -rn "is_staff" ../studiohub/backend/apps/organization/api ../studiohub/backend/apps/organization/selectors ../studiohub/backend/apps/production/api 2>/dev/null | grep -vi test | head -30`
Expected: list of candidate bypass sites (or empty besides admin classes).

- [ ] **Step 2: Write the failing test**

```python
# ../studiohub/backend/apps/organization/tests/api/viewsets/test_org_access_scope.py
def test_member_cannot_open_unpermitted_org(api_client, org_a, org_b, org_c, user2_member_of_a_b):
    api_client.force_authenticate(user2_member_of_a_b)
    res = api_client.get(f"/api/v1/organizations/{org_c.id}/")
    assert res.status_code in (403, 404)


def test_staff_non_superuser_gets_member_scope(api_client, org_a, org_c, staff_user_member_of_a):
    assert staff_user_member_of_a.is_staff and not staff_user_member_of_a.is_superuser
    api_client.force_authenticate(staff_user_member_of_a)
    res = api_client.get("/api/v1/organizations/")
    ids = {str(o["id"]) for o in res.data["results"]} if isinstance(res.data, dict) else {str(o["id"]) for o in res.data}
    assert str(org_a.id) in ids and str(org_c.id) not in ids
```

(Adapt fixture names/URL prefix/list envelope to the repo's existing `rbac_helpers.py` + `test_role_actions.py` patterns — read them first; keep the asserted behaviors verbatim.)

- [ ] **Step 3: Run test to verify it fails**

Run: `uv run pytest apps/organization/tests/api/viewsets/test_org_access_scope.py --no-cov -q` (from `../studiohub/backend`)
Expected: FAIL on any bypass site; PASS where already correct (keep those assertions as regression pins).

- [ ] **Step 4: Write minimal implementation**

Replace each bypass with the strict predicate (example shape — match the file's existing style):

```python
if getattr(request.user, "is_superuser", False):
    return qs
return qs.filter(memberships__user=request.user, memberships__is_deleted=False).distinct()
```

Touch only the predicate; do not restructure viewsets/selectors.

- [ ] **Step 5: Run tests to verify**

Run: `uv run pytest apps/organization/tests/api/viewsets/test_org_access_scope.py apps/organization/tests/api/viewsets/test_role_actions.py --no-cov -q` plus `uv run python manage.py check`
Expected: PASS, no issues.

- [ ] **Step 6: Commit**

```bash
git -C ../studiohub add backend/apps/organization/api backend/apps/organization/selectors backend/apps/organization/tests/api/viewsets/test_org_access_scope.py
git -C ../studiohub commit -m "feat(security): strict superuser-only org scoping"
```

### Task 2: Backend — IDOR matrix for org/project/search endpoints

**Files:**
- Modify: only what the matrix proves broken (same dirs as Task 1 + search viewsets)
- Test: extend `../studiohub/backend/apps/organization/tests/api/viewsets/test_org_access_scope.py`; new `../studiohub/backend/apps/masterdata/tests/test_search_scope.py` only if a search endpoint needs it (check `apps/*/api/*search*` first)

**Interfaces:**
- Consumes: Task 1 predicates.
- Produces: User 2 (member of A+B) gets 403/404 for every C-scoped request: org detail, org projects, people, departments, teams, offices, clients, vendors, dashboard, reports, org search, project search; project detail respects project rules on top.

- [ ] **Step 1: Write the failing tests**

```python
@pytest.mark.parametrize("resource", ["projects", "people", "departments", "teams", "offices", "clients", "vendors"])
def test_member_cannot_list_unpermitted_org_resource(api_client, org_c, user2_member_of_a_b, resource):
    api_client.force_authenticate(user2_member_of_a_b)
    res = api_client.get(f"/api/v1/organizations/{org_c.id}/{resource}/")
    assert res.status_code in (403, 404)
    assert "Project 4" not in json.dumps(res.data)
```

(Resolve each resource's real route from `apps/organization/api/routers.py` + `apps/masterdata/api/urls.py`; skip resources with no such nested route and note the skip in the report — do not invent routes.)

- [ ] **Step 2: Run to verify failures**

Run: `uv run pytest apps/organization/tests/api/viewsets/test_org_access_scope.py --no-cov -q`
Expected: FAIL on unprotected resources.

- [ ] **Step 3: Implement minimal fixes** (membership check via `has_organization_access` / selector scoping / `check_object_permissions`; one resource at a time)

- [ ] **Step 4: Re-run full matrix + neighbors**

Run: `uv run pytest apps/organization/tests/api/viewsets/test_org_access_scope.py apps/organization/tests/api/viewsets/test_role_actions.py apps/masterdata/tests/test_org_bulk_enable.py --no-cov -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C ../studiohub commit -m "fix(security): IDOR protection across org-scoped endpoints"
```

### Task 3: Frontend — strict `isPlatformSuperuser` + caller audit

**Files:**
- Modify: `src/core/permissions/rbac.ts:793-802`
- Modify: only callers proven to depend on the role-label fallback (audit all `isSuperAdminUser`/`isPlatformSuperuser` uses first)
- Test: `src/core/permissions/__tests__/isPlatformSuperuser.test.ts` (new; check dir layout first)

**Interfaces:**
- Consumes: `User.is_superuser` (boolean from `/api/v1/auth/me/` shape — verify field name in `src/types/identity.ts` first).
- Produces: `isPlatformSuperuser(user)` true IFF `Boolean(user.is_superuser)`; every downstream helper unchanged in signature.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { isPlatformSuperuser } from '../rbac';

describe('isPlatformSuperuser (strict)', () => {
  it('returns false for Platform Admin role label without is_superuser', () => {
    expect(isPlatformSuperuser({ id: 'u', role: 'Platform Admin', is_superuser: false } as any)).toBe(false);
  });
  it('returns true for is_superuser regardless of role', () => {
    expect(isPlatformSuperuser({ id: 'u', role: 'Artist', is_superuser: true } as any)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/core/permissions/__tests__/isPlatformSuperuser.test.ts`
Expected: FAIL on the role-label case.

- [ ] **Step 3: Write minimal implementation**

```ts
export function isPlatformSuperuser(user: User | null): boolean {
  if (!user) return false;
  return Boolean(user.is_superuser);
}
```

- [ ] **Step 4: Audit callers for fallback dependence**

Run: `grep -rn "isSuperAdminUser\|isPlatformSuperuser" src --include="*.tsx" --include="*.ts" | grep -v __tests__`
Expected: caller list; for each, confirm correct behavior under strictness (superuser sees all; role-admins now membership-scoped). Fix ONLY callers that break (e.g. hard-gated admin screens needing a membership-aware fallback) — list them in the report.

- [ ] **Step 5: Run tests + typecheck**

Run: `pnpm vitest run src/core/permissions src/core/organization src/layouts && pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/permissions/rbac.ts src/core/permissions/__tests__/isPlatformSuperuser.test.ts
git commit -m "feat(security): strict superuser-only platform check"
```

### Task 4: Frontend — switcher lock, zero-org, persisted-selection validation

**Files:**
- Modify: `src/layouts/OrganizationSwitcher.tsx:41-57` (only if gaps found), `src/core/organization/OrganizationContext.tsx:122-145`
- Test: extend `src/core/organization/__tests__/switchOrganization.test.tsx` + new `src/layouts/__tests__/OrganizationSwitcher.test.tsx` (check existing layout test pattern in `ProjectSwitcher.test.tsx` first)

**Interfaces:**
- Consumes: `userOrganizations` (server-filtered), `isSuperAdminUser` (Task 3).
- Produces: 0 orgs → `org-empty-badge`; 1 org → `org-static-badge` (no dropdown), org auto-locked; persisted id revalidated on boot.

- [ ] **Step 1: Write the failing tests**

```tsx
it('single-org user sees a locked static badge, never a dropdown', async () => {
  // render switcher with userOrganizations=[orgA], is_superuser=false
  expect(await screen.findByTestId('org-static-badge'));
  expect(screen.queryByRole('button', { name: /switch studio/i })).toBeNull();
});

it('drops a persisted org the user lost access to', async () => {
  localStorage.setItem('studiohub_active_org_id', 'org-C');
  // render provider with directory=[orgA, orgB], memberships for A+B
  await waitFor(() => expect(localStorage.getItem('studiohub_active_org_id')).toBe('org-A'));
});
```

(Follow the `switchOrganization.test.tsx` harness verbatim for provider/auth mocking.)

- [ ] **Step 2: Run to verify failures**

Run: `pnpm vitest run src/layouts/__tests__/OrganizationSwitcher.test.tsx src/core/organization/__tests__/switchOrganization.test.tsx`
Expected: FAIL where behavior missing (much exists already — keep passing assertions as pins).

- [ ] **Step 3: Implement minimal deltas only** (the badge branches at `OrganizationSwitcher.tsx:117-170` and the boot effect at `OrganizationContext.tsx:122-145` already cover most; fill proven gaps: stale favorite/recent ids pointing outside `userOrganizations` must be filtered at read time, e.g. `recentOrgs`/`favoriteOrgs` already intersect — verify, and prune persisted ids that never resolve).

- [ ] **Step 4: Re-run + typecheck**

Run: `pnpm vitest run src/layouts src/core/organization && pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(org): single-org lock and selection validation"
```

### Task 5: Frontend — project scoping + org-switch cascade

**Files:**
- Modify: `src/layouts/ProjectSwitcher.tsx:38-80`, `src/core/production/useProductionStore.ts` (only proven gaps), search hooks feeding header/project search (audit first: grep `useQuery` in search components)
- Test: extend `src/layouts/__tests__/ProjectSwitcher.test.tsx` + search-hook tests beside them

**Interfaces:**
- Consumes: `currentOrganization.id`, `filterAccessibleProjects`, Task 4 selection guarantees.
- Produces: switcher/search show current-org permitted projects only; org switch clears active project + search state + re-keys queries with org+user scope.

- [ ] **Step 1: Write the failing tests**

```tsx
it('never shows org C projects after switching from A to B', async () => {
  // seed projects for A then switch org to B; assert project list contains only B ids
  // and useProductionStore activeProjectId is null or a B id
});

it('project search keys include the organization id', async () => {
  // assert the search hook queryKey contains currentOrganization.id and user id
});
```

- [ ] **Step 2: Run to verify**

Run: `pnpm vitest run src/layouts/__tests__/ProjectSwitcher.test.tsx`
Expected: FAIL on missing cascade pieces.

- [ ] **Step 3: Implement minimal fixes** (reuse `resetActiveProjectForOrg`/`setActiveProject(null)`; add org+user to search query keys following the existing `useProjects(undefined, orgId)` pattern — do not invent a new key architecture)

- [ ] **Step 4: Re-run + typecheck**

Run: `pnpm vitest run src/layouts src/core/production src/modules/production && pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(security): org-scoped projects and switch cascade"
```

### Task 6: Frontend — header/palette/search audit + version/env

**Files:**
- Modify: `src/shared/components/CommandPalette.tsx`, `src/layouts/Header.tsx`, global/project search components (audit-determined), version/env display source (audit-determined)
- Test: `src/shared/components/__tests__/CommandPalette.test.tsx` (new) + header audit tests

**Interfaces:**
- Consumes: `userOrganizations`, `currentOrganization`, permission `can()` gates.
- Produces: palette/search navigate only to accessible orgs/projects; org-scoped queries; admin entries hidden without grant; version/env from the live mechanism.

- [ ] **Step 1: Audit command palette + search data sources**

Run: `grep -rn "organizations\|/organizations" src/shared/components/CommandPalette.tsx | head; grep -rln "useProjects\|project.*search" src/shared/components src/layouts | head`
Expected: concrete list of unscoped sources (or confirmation all consume scoped hooks).

- [ ] **Step 2: Write failing tests** (palette offers only accessible orgs; no cross-org navigation targets; version text matches the version module, not a literal)

- [ ] **Step 3: Implement minimal fixes** (filter palette items through `userOrganizations`/`filterAccessibleProjects`; permission-gate admin entries; wire version/env to existing mechanism)

- [ ] **Step 4: Re-run + typecheck + build**

Run: `pnpm vitest run src/shared src/layouts && pnpm exec tsc --noEmit && pnpm build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(security): scope palette, search, and header to access"
```

### Task 7: E2E + docs + verification sweep

**Files:**
- Create: `e2e/org-access.spec.ts` (check `playwright.config.ts` + `e2e/` layout first)
- Create: `docs/architecture/ORGANIZATION_ACCESS.md` (matrix: surface → enforcement point → test)
- Test: the E2E file itself

**Interfaces:**
- Consumes: seeded superuser (all orgs), User 2 (A+B), backend + frontend from Tasks 1–6.
- Produces: green E2E for §18 scenarios (switcher subset, URL-UUID denial, org-switch cascade, single-org lock, zero-org state).

- [ ] **Step 1: Write E2E spec** (login as User 2 → header shows A+B not C → direct `/organizations/<C-id>` denied → switch A→B clears project → single-org user has no dropdown)

- [ ] **Step 2: Run**

Run: `pnpm exec playwright test e2e/org-access.spec.ts`
Expected: PASS (requires seeded users/orgs — read existing e2e fixtures first and reuse them; do not hand-roll seed data if fixtures exist).

- [ ] **Step 3: Write docs matrix + full verification**

Run: `pnpm vitest run && pnpm exec tsc --noEmit && pnpm build` and `(cd ../studiohub/backend && uv run python manage.py check && uv run pytest apps/organization apps/identity --no-cov -q)`
Expected: all green (list any pre-existing failures by name).

- [ ] **Step 4: Commit**

```bash
git add e2e/org-access.spec.ts docs/architecture/ORGANIZATION_ACCESS.md
git commit -m "test(e2e): user-specific organization access + docs"
```
