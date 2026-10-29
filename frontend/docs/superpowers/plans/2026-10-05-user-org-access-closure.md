# User-Based Org Access + Single-org Select Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining gaps in user-specific organization access: drop legacy alias routes, validate the 0/1/2+ org-state machine, remove hardcoded org fallbacks, wire version info from the live API, expand seeds for multi-org E2E.

**Architecture:** Extend the existing ADR-0033 architecture; no new permission system. Backend aliases are deleted (locked decision); lists stay 200-empty-scoped (locked decision); detail and write paths already gate via `has_organization_access`.

**Tech Stack:** Django REST Framework (`uv run`), React 19 + TanStack Query (`pnpm`), pytest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-05-user-org-access-plus-design.md`

## Global Constraints

- Strict superuser-only; `is_staff` has no privilege; role labels grant nothing outside membership/permission evaluation.
- Backend list scoping stays 200-empty (locked), detail/write stays gated. Aliases deleted, never preserved as duplicate paths.
- Delegation key: existing `has_organization_access` middleware helper; no new permission logic.
- Frontend single source of truth: `OrganizationContext` + `useOrganization`; no component derives org access separately; no `currentOrganization || 'org-apex-01'` fallbacks left on org-scoped surfaces.
- Logout + user change clear the query cache and persisted org/project state.
- All runs: `uv run python manage.py check`, `uv run pytest` (backend), `pnpm vitest run`, `pnpm exec tsc --noEmit`, `pnpm build`, `pnpm exec playwright test` (frontend — `pnpm test:e2e` does not exist; Playwright is invoked directly).

## Review Focus

- A controller URL under `api/organization-legacy/` that survives the alias removal — alias is DELETED, never kept behind a flag.
- Fallback paths that silently re-synthesize org access after membership revocation (membership → user.role synthesis in getUserMembership) — must be org-bound, never auto-grant.
- Query cache not being dropped on logout (so a signing-out user leaves the next login with stale orgs).
- Legacy seed or e2e fixture that still asserts the 1-org universe (passes vacuously and hides the underlying behavior).
- A version/env label in the shell header that still reads a static string instead of the live `/api/v1/info/version/` response.

---

### Task 1: Backend — delete legacy org aliases, pin revocation behavior

**Files:**
- Delete: `../studiohub/backend/apps/organization/api/urls_legacy.py` (only if it exists solely as an alias mount; audit before deleting)
- Modify: `../studiohub/backend/config/v1_urls.py` (remove the alias mount)
- Test: `../studiohub/backend/apps/organization/tests/api/test_alias_removed.py` (new)

**Interfaces:**
- Consumes: existing `OrganizationViewSet` + `AuthOrganizationsView` and their permission scoping (unchanged).
- Produces: no new endpoints; alias routes respond 404 after mount removal.

**Launch context (read before writing):**
- `config/v1_urls.py:30` mounts `include("apps.organization.api.urls_legacy")` — remove that line.
- `apps/organization/api/urls_legacy.py` registers `organizations` under `app_name = "organization-legacy"` and provides IDOR-covered compat surface from Task 2 of the earlier plan (`test_org_access_scope.py`, `routes are nested under organization_legacy`). Before deleting anything, grep for remaining live callers (`license_organization_api`, middleware `and` conditions, reverse-URL names used by base tests like `legacy-client-*`, `legacy-vendor-*`, existing `apps/organization/tests/api/api/test_*` for reverse() checks) — alias-locked routes are OK to lose; however, if `urls_legacy` also hosts the nested tree (`Compat*OrganizationViewSet` subclass routes that the org workspace still uses), then deletion == breaking the real app; in that case the smallest correct resolution is: delete only the `/organization/organizations/` and `/organizations/my/` style alias mounts + the `OrganizationSingletonLegacyView` path NOT destructively (narrow the mounts, keep the active tree) — then document the finding in the report and move the "delete legacy aliases" closure to a dedicated API-cleanup ticket.

- [ ] **Step 1: Write the failing tests**

```python
# ../studiohub/backend/apps/organization/tests/api/test_alias_removed.py
def test_legacy_organizations_alias_removed(api_client, org, member_client):
    member_client.force_authenticate(user=...)  # member of org
    res = member_client.get("/api/v1/organization/organizations/")
    assert res.status_code in (404,), "legacy alias must be gone"


def test_canonical_list_stays_scoped(member_client, org, foreign_org):
    api_client.force_authenticate(user=...)
    res = member_client.get("/api/v1/organizations/")
    ids = {str(o["id"]) for o in res.data["results"]} if isinstance(res.data, dict) else {str(o["id"]) for o in res.data}
    assert str(foreign_org.id) not in ids


def test_membership_revocation_blocks_access_immediately(api_client, org, user):
    # active membership → visible; soft-delete membership → immediately 403/404 from detail
    ...
```

(Adapt fixture names to `apps/organization/tests/rbac_helpers.py` + conftest; verify the exact alias path from `urls_legacy.py` before assuming.)

- [ ] **Step 2: Run to verify it fails**

Run: `uv run pytest apps/organization/tests/api/test_alias_removed.py --no-cov -q` (from `../studiohub/backend`)
Expected: FAIL (alias still resolves).

- [ ] **Step 3: Implement minimal deferral of the alias removal**

Delete the alias mount in `config/v1_urls.py` and any factory/default registered legacy routes whose namespace belongs to the alias surface. Keep the active nested/compat tree untouched; if grep in the launch step shows the tree is load-bearing (live usage), narrow the removal to only the alias entries and note the residual scope in the report (do NOT silently preserve actual duplicate endpoints as active code).

- [ ] **Step 4: Run suite + checks**

Run: `uv run pytest apps/organization --no-cov -q && uv run python manage.py check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C ../studiohub commit -m "fix(api): delete legacy organization aliases"
```

### Task 2: Backend — live version endpoint + multi-org seed for E2E

**Files:**
- Create: `../studiohub/backend/apps/core/api/views/version.py` (if `apps/core/api/views/` doesn't exist, find the established place and put the handler there)
- Modify: the URL wiring file used by the rest of the frontend API endpoints (`apps/core/api/urls*.py` or top-level `config/v1_urls.py`, matching existing style)
- Modify: `../studiohub/backend/apps/core/management/commands/seed_dev.py` (add a second org + memberships so multi-org E2E turns on; mark prominently so the e2e claims in Task 4 use those exact data)
- Test: version endpoint test beside the handler; seed coverage not unit-testable — verify via the E2E pair in Task 4

**Interfaces:**
- Produces: `GET /api/v1/info/version/` → `{ version: string; environment: string; commit?: string }` (public, no auth); settings from `settings.VERSION` / deployed env var pattern with a safe default for development.
- No breaking change to existing URLs.

- [ ] **Step 1: Write the failing test**

```python
# backend/apps/<handling>/tests/api/test_version_info.py
def test_version_endpoint(api_client):
    res = api_client.get("/api/v1/info/version/")
    assert res.status_code == 200
    assert isinstance(res.data["version"], str) and res.data["version"]
    assert isinstance(res.data["environment"], str) and res.data["environment"]
```

- [ ] **Step 2: Run to verify it fails**

Run: `uv run pytest apps/core --no-cov -k version -q` (pick the actual location)
Expected: FAIL (404).

- [ ] **Step 3: Implement endpoint + seed enrichment**

Wire the endpoint. Update `seed_dev.py` minimally to create a second organization + assign `supervisor@` membership, so the frontend single-org lock and multi-org universes are both provable. Do NOT overwrite existing seed rows.

- [ ] **Step 4: Run checks** (backend: manage.py check + targeted test; frontend e2e run in Task 4)

- [ ] **Step 5: Commit**

### Task 3: Frontend — organization selection state machine + fallback removal

**Files:**
- Modify: `src/core/organization/OrganizationContext.tsx` (0/1/2+ selection + persisted-id validation + logout/user-change cache clear)
- Modify: `src/core/permissions/accessControl.ts`, any file found with `|| 'org-apex-01'` fallbacks on org-scoped data paths
- Modify: `src/layouts/Header.tsx` + `src/layouts/OrganizationSwitcher.tsx` (only if wires break; previous work already hid the switcher at 1 org)
- Test: extend `src/core/organization/__tests__/switchOrganization.test.tsx` + add `src/layouts/__tests__/HeaderOrgLock.test.tsx` (new)

**Interfaces:**
- Consumes: `organizationApi.getMyOrganizations()`, `/api/v1/auth/me·is_superuser`.
- Produces: `accessibleOrganizations` semantics remain exported from `OrganizationContext`; org-scoped components render nothing (or their individual "no selection" path) under a 0-org context without hardcoded tenant ids.

- [ ] **Step 1: Write the failing tests**

```tsx
// 1-org lock stays; 0-org renders empty state and skips org-scoped fetch;
// logout/user swap invalidates existing org caches; persisted org-id discarded when revoked.
it.each([
  ['0 access shows empty badge + no selection', 0],
  ['1 access auto-selects', 1],
  ['2 access shows switcher, selects first permitted', 2],
])('selection state machine — %s', async (_label, count) => {
  // mock auth/me/organizations with `count` orgs; assert UI + queryClient calls
});
```

- [ ] **Step 2: Run to verify they fail** (expect at least the 0-org + revocation cases to fail; the 1-org boot path was pinned earlier).

- [ ] **Step 3: Implement**

Fix `getUserMembership` synthetic membership so a user without a canonical DB membership does not gain organization access in a context it does not belong to (align with the earlier ruling); remove `|| 'org-apex-01'` fallbacks on org-scoping paths; bootstrap loading state picks 0/1/2 per rules; logout cleanup clears `queryClient` + persisted org ids.

- [ ] **Step 4: Run suites**

Run: `pnpm vitest run src/core/permissions src/core/organization src/layouts src/modules && pnpm exec tsc --noEmit && pnpm build`
Expected: PASS.

- [ ] **Step 5: Commit**

### Task 4: Frontend — E2E activation + docs sync

**Files:**
- Modify: `e2e/org-access.spec.ts` (unskip/fixme'd cases once Task 2 seed is live; keep 1-org lock assertions actually exercised)
- Modify: `docs/api/permissions.md`, `docs/02-architecture/authorization.md`, `../studiohub/docs/02-architecture/authorization.md` (sync backend copy)
- Optionally add ADR only if behavior diverges from ADR-0033 (alias removal + 200-empty list stance is a decision consistency note — document, not new ADR unless the change is material)
- Test: the e2e spec itself; CI sweep

**Interfaces:**
- Consumes: all prior tasks' outputs + seed matrix from T2.
- Produces: unskipped E2E assertions covering the 0/1/2-org sample + superuser-sees-all + member-sees-membership-only for each seeded user.

- [ ] **Step 1: Update e2e to the seeded multi-org universe** (use `best-effort` markers where the underlying Auth bootstrap means assertions need deterministic fixture data).
- [ ] **Step 2: Run E2E + full stack**

Run: `pnpm exec playwright test e2e/org-access.spec.ts e2e/organization-isolation.spec.ts e2e/route-authorization.spec.ts && pnpm vitest run && pnpm exec tsc --noEmit && pnpm build` and backend suite re-run.

- [ ] **Step 3: Document per spec §3.5** (0/1/2+ rules in the UI, alias deletion, 200-empty vs 403/404, version endpoint).
- [ ] **Step 4: Commit**
