# Frontend Consolidation (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove duplicated frontend authorization logic and the second Group manager so `can.ts` is the single evaluation entry, engine-backed checks replace role-string matching, and simulator state cannot leak into production gating.

**Architecture:** Deprecate-then-delete for `rbac.can`/`isUserAdmin` (aliases with warn-once, call sites migrated in the same branch); new engine-backed `hasElevatedAccess`; exact-match role codes replacing substring heuristics; import-boundary test pinning simulator stores to simulator UI; platform Groups surface converted to read-only after source verification.

**Tech Stack:** React + TypeScript (strict:false), zustand, `@/core/permissions` engine, vitest + jsdom + testing-library, biome, Playwright (live Django only).

**Spec:** `docs/superpowers/specs/2026-10-07-backend-frontend-consolidation-design.md` (audit: `docs/BACKEND_FRONTEND_CONSOLIDATION_REPORT.md`)

## Global Constraints

- Frontend gating is a UX affordance; the Django backend remains authoritative — never weaken a check, only route it through the engine.
- Deny-by-default: no user, empty query, missing grant, missing membership, or scope mismatch evaluates to false.
- No endpoint removals, no navigation/route changes, no new `GET all` patterns; selectors stay org-scoped, permission-aware, server-searched, paginated.
- Preserve deep links, keyboard flows, workspace behavior, validation, error handling, Playwright coverage.
- Backend migrations (N1/N2/N7/N8) are OUT OF SCOPE here — separate session in `../studiohub`. `Person.user_id` stays frontend-only until Phase 1 lands; do not invent a contract.
- Correct the audit where source disagrees: `isSuperAdminUser` and `accessControl.can` already delegate to the engine (aliases, keep); `usePermissions().can` is already canonical (keep); `domainPermissions` "capabilities" is description prose (no rename).

## Review Focus

- A user whose `role` string contains "admin" as a substring (e.g. a custom "Readministrator" code) must NOT gain elevated access after M2 — exact code matching must replace every `includes('admin')` path, pinned by a test with such a hostile role code.
- An artist who is explicitly granted a CRUD permission via RolePermission must still be able to act — the PermissionControl rewrite must evaluate the engine rather than hard-denying all artist-coded roles, pinned by a test.
- With the simulator open in another tab (persisted zustand `studiohub-permissions-v1`), production guards must still evaluate the session user — pinned by the import-boundary test plus a `usePermissions` session-purity test.
- `PlatformRolesTab` consumers of `GroupsSectionHandle.openCreate` must not break when the platform surface becomes read-only — pinned by updating the handle/ref call site in the same task.
- Any NEW future import of `usePermissionStore` outside the simulator allowlist must fail CI — pinned by the boundary test in Task 7.

---

### Task 1: M1 — Demote `rbac.can` to deprecated alias of `can.ts`

**Files:**
- Modify: `src/core/permissions/rbac.ts:775-803` (legacy `can`)
- Modify: `src/core/permissions/can.ts:96-109` (reuse existing `legacyCanArgs`)
- Test: `src/core/permissions/__tests__/canCanonical.test.ts` (new)

**Interfaces:**
- Consumes: `can(user, query)` and `legacyCanArgs(permission, context)` from `./can`; `evaluateUserPermission` stays the engine inside `can.ts`.
- Produces: deprecated `can(user, permission, context)` in `rbac.ts` with identical behavior plus warn-once; later tasks migrate call sites to `can.ts`.

- [ ] **Step 1: Read the current legacy wrapper**

Run: `sed -n '770,815p' src/core/permissions/rbac.ts`
Expected: see `export function can(` with `(user, permission, context)` signature delegating (or not) to the evaluator.

- [ ] **Step 2: Write the failing test**

```ts
// src/core/permissions/__tests__/canCanonical.test.ts
import { describe, expect, it, vi } from 'vitest';
import { can as canonicalCan } from '@/core/permissions/can';
import { can as legacyCan } from '@/core/permissions/rbac';
import type { User } from '@/types/identity';

const user = { id: 'u1', email: 'a@x.io', role: 'org_admin', is_superuser: false } as unknown as User;

describe('can() canonical surface', () => {
  it('legacy rbac.can matches canonical can() for a permission string', () => {
    const ctx = { organizationId: 'org1' };
    expect(legacyCan(user, 'shot.view', ctx)).toBe(
      canonicalCan(user, { permission: 'shot.view', organizationId: 'org1' }),
    );
  });

  it('legacy rbac.can warns once about deprecation', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    legacyCan(user, 'shot.view', { organizationId: 'org1' });
    legacyCan(user, 'shot.view', { organizationId: 'org1' });
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('hostile role code containing "admin" as substring gains nothing by itself', () => {
    const hostile = { ...user, role: 'Readministrator', permissions: [] } as unknown as User;
    expect(canonicalCan(hostile, { permission: 'page.testing', organizationId: 'org1' })).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/core/permissions/__tests__/canCanonical.test.ts`
Expected: FAIL (no `console.warn` in legacy `can`; hostile-code case documents intent).

- [ ] **Step 4: Implement the alias**

```ts
// src/core/permissions/rbac.ts — replace the body of legacy `can`
import { can as canonicalCan, legacyCanArgs } from './can';

let legacyCanWarned = false;

/**
 * @deprecated Use `can(user, query)` from `./can` (or `usePermissions().can`). Thin alias, kept for one release.
 */
export function can(
  user: User | null,
  permission: string,
  context?: Partial<PermissionEvaluationContext>,
): boolean {
  if (!legacyCanWarned) {
    legacyCanWarned = true;
    console.warn('[permissions] rbac.can is deprecated — use can(user, query) from ./can');
  }
  return canonicalCan(user, legacyCanArgs(permission, context));
}
```

Keep `isPlatformSuperuser`, `accessControl.can`, `usePermissions().can` untouched (verified aliases/canonical).

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/core/permissions/__tests__/canCanonical.test.ts`
Expected: PASS (3/3).

- [ ] **Step 6: Commit**

```bash
git add src/core/permissions/rbac.ts src/core/permissions/__tests__/canCanonical.test.ts
git commit -m "refactor: demote rbac.can to deprecated alias of canonical can()"
```

### Task 2: M1 — Migrate direct `rbac.can` / `accessControl.can` call sites to `can.ts`

**Files:**
- Modify: callers found via `grep -rn "from '@/core/permissions/rbac'" src layouts` and `accessControl.can(`, `canAction(` — verified inventory cites `src/layouts/Sidebar.tsx:324`, `src/shared/components/CommandPalette.tsx:71`, `src/routes/PermissionRoute.tsx:73`, `src/pages/TestingPage.tsx:122`
- Test: existing `src/routes/__tests__/RoutePermissionGuard.test.tsx` + Task 1 test (no new file)

**Interfaces:**
- Consumes: `can(user, CanQuery)` from `../core/permissions/can` (or the hook form `usePermissions().can(query)` inside components).
- Produces: zero non-test imports of `can` from `./rbac` or `accessControl` (assert with grep in Step 5).

- [ ] **Step 1: Enumerate remaining call sites**

Run: `grep -rn "rbac').*\<can\>\|from './rbac'" src --include='*.tsx' --include='*.ts' | grep -v __tests__ | grep -v "checkUserHas\|evaluateUser\|isPlatform\|isUserAdmin\|getUserMembership"`
Expected: short list (Sidebar, CommandPalette, PermissionRoute, TestingPage or fewer).

- [ ] **Step 2: Replace each site with the canonical form**

```tsx
// BEFORE (example shape)
import { can } from '@/core/permissions/rbac';
const ok = can(user, 'shot.create', { organizationId: orgId, projectId });

// AFTER — outside components:
import { can } from '@/core/permissions/can';
const ok = can(user, { permission: 'shot.create', organizationId: orgId, projectId });

// AFTER — inside components (preferred):
const { can } = usePermissions();
const ok = can({ permission: 'shot.create' }); // org/project/show default from context
```

Apply per site, preserving the exact permission strings and context values.

- [ ] **Step 3: Verify zero legacy `can` imports remain**

Run: `grep -rn "import {[^}]*\bcan\b[^}]*} from '@/core/permissions/rbac'" src --include='*.ts' --include='*.tsx' | grep -v __tests__; grep -rn "accessControl.can(" src --include='*.tsx' | grep -v __tests__`
Expected: no output (both empty).

- [ ] **Step 4: Run affected test suites**

Run: `npx vitest run src/routes/__tests__ src/layouts/__tests__ src/core/permissions/__tests__`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "refactor: migrate can() call sites to canonical can.ts surface"
```

### Task 3: M2 — Add engine-backed `hasElevatedAccess`, deprecate `isUserAdmin`

**Files:**
- Modify: `src/core/permissions/rbac.ts:293-345` (append new fn, deprecate old in place)
- Test: extend `src/core/permissions/__tests__/canCanonical.test.ts`

**Interfaces:**
- Consumes: `evaluateUserPermission(user, code, context)` + `getUserMembership(user, organizationId)`.
- Produces: `hasElevatedAccess(user, organizationId?): boolean` — true for superuser break-glass OR any active org membership whose role carries an admin-scoped grant; never true on substring alone.

- [ ] **Step 1: Write the failing test (append to `canCanonical.test.ts`)**

```ts
import { hasElevatedAccess } from '@/core/permissions/rbac';

describe('hasElevatedAccess', () => {
  it('returns true for superuser break-glass', () => {
    const su = { ...user, is_superuser: true } as unknown as User;
    expect(hasElevatedAccess(su, 'org1')).toBe(true);
  });

  it('returns false for hostile substring role without grants', () => {
    const hostile = {
      ...user,
      role: 'Readministrator',
      permissions: [],
      organization_memberships: [],
    } as unknown as User;
    expect(hasElevatedAccess(hostile, 'org1')).toBe(false);
  });

  it('returns true when the membership role carries an admin grant', () => {
    const admin = {
      ...user,
      role: 'org_admin',
      organization_memberships: [
        { organization_id: 'org1', role: 'org_admin', status: 'Active', permissions: ['organization.manage'] },
      ],
    } as unknown as User;
    expect(hasElevatedAccess(admin, 'org1')).toBe(true);
  });
});
```

(If `evaluateUserPermission` needs richer membership shapes, mirror the shape used in `RoutePermissionGuard.test.tsx` — read that file first and adjust literals, keeping the three assertions.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/permissions/__tests__/canCanonical.test.ts`
Expected: FAIL with "hasElevatedAccess is not a function".

- [ ] **Step 3: Implement**

```ts
const ELEVATED_GRANT_PROBES = [
  'organization.manage',
  'organization.admin',
  'page.testing',
  'platform.admin.view',
];

/**
 * Engine-backed elevated-access check. Replaces `isUserAdmin` substring matching.
 * True when: superuser break-glass, OR evaluateUserPermission grants any
 * elevated probe within the organization boundary.
 */
export function hasElevatedAccess(user: User | null, organizationId?: string): boolean {
  if (!user) return false;
  if (user.is_superuser) return true;
  const context: PermissionEvaluationContext = { organizationId };
  return ELEVATED_GRANT_PROBES.some((code) => {
    try {
      return evaluateUserPermission(user, code, context);
    } catch {
      return false;
    }
  });
}

/**
 * @deprecated Use `hasElevatedAccess(user, organizationId)` — substring role matching is unsafe.
 */
export function isUserAdmin(user: User | null, organizationId?: string): boolean {
  return hasElevatedAccess(user, organizationId);
}
```

Replace the existing `isUserAdmin` body (lines 293+) with the delegating deprecated version; keep its signature.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/permissions/__tests__/canCanonical.test.ts`
Expected: PASS. Then run full permissions + routes suites: `npx vitest run src/core/permissions src/routes/__tests__`

- [ ] **Step 5: Commit**

```bash
git add src/core/permissions/rbac.ts src/core/permissions/__tests__/canCanonical.test.ts
git commit -m "refactor: add engine-backed hasElevatedAccess, deprecate isUserAdmin"
```

### Task 4: M2 — Replace `isUserAdmin`/`isSuperAdminUser` call sites

**Files:**
- Modify: `src/layouts/Sidebar.tsx` (~line 324), `src/shared/components/CommandPalette.tsx` (~line 71), `src/routes/PermissionRoute.tsx` (~line 73, `requireAdmin` path), `src/pages/TestingPage.tsx` (~line 122)
- Test: existing suites `src/layouts/__tests__`, `src/routes/__tests__` (no new file)

**Interfaces:**
- Consumes: `hasElevatedAccess(user, orgId)` from Task 3; `isPlatformSuperuser` stays ONLY for true break-glass branches.
- Produces: no `isUserAdmin` imports outside `rbac.ts` itself.

- [ ] **Step 1: Locate each site and classify**

Run: `grep -rn "isUserAdmin\|isSuperAdminUser" src --include='*.tsx' --include='*.ts' | grep -v __tests__ | grep -v "core/permissions/"`
Expected: the four files above. For each, decide: break-glass intent (superuser-only diagnostics) → `isPlatformSuperuser`; admin-gate intent → `hasElevatedAccess(user, orgId)`.

- [ ] **Step 2: Replace (pattern per site)**

```tsx
// BEFORE
import { isUserAdmin } from '@/core/permissions/rbac';
if (isUserAdmin(user, orgId)) { /* admin UI */ }

// AFTER
import { hasElevatedAccess } from '@/core/permissions/rbac';
if (hasElevatedAccess(user, orgId)) { /* admin UI */ }
```

Keep surrounding logic/JSX identical. `PermissionRoute requireAdmin` maps to `hasElevatedAccess`; `TestingPage` diagnostics gate maps to `hasElevatedAccess`.

- [ ] **Step 3: Verify no stale imports**

Run: `grep -rn "isUserAdmin" src --include='*.ts' --include='*.tsx' | grep -v __tests__`
Expected: only the deprecated definition in `rbac.ts`.

- [ ] **Step 4: Run suites**

Run: `npx vitest run src/layouts/__tests__ src/routes/__tests__ src/core/permissions/__tests__`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "refactor: route admin gates through hasElevatedAccess"
```

### Task 5: M2 — Remove substring heuristics from `PermissionControl`

**Files:**
- Modify: `src/core/permissions/PermissionControl.tsx:78-91,147-171`
- Test: `src/core/permissions/__tests__/permissionControl.test.tsx` (new)

**Interfaces:**
- Consumes: `usePermissions().can`, `checkUserHasRole`, `isPlatformSuperuser` (break-glass only, unchanged).
- Produces: `isArtist` computed from exact role-code match + engine; role options use exact matching.

- [ ] **Step 1: Write the failing test**

```tsx
// src/core/permissions/__tests__/permissionControl.test.tsx
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { usePermissionControl } from '@/core/permissions/PermissionControl';
import { AuthContext } from '@/core/auth/AuthContext';

// Minimal provider harness: wrap hook with AuthContext carrying a hostile-coded user.
function harness(user: any, options: any) {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthContext.Provider value={{ user, isAuthenticated: true } as any}>{children}</AuthContext.Provider>
  );
  return renderHook(() => usePermissionControl(options), { wrapper });
}

describe('usePermissionControl role matching', () => {
  it('does not treat substring "admin" in a custom code as admin (prohibitedRoles exact match)', () => {
    const { result } = harness(
      { id: 'u1', role: 'Readministrator', permissions: ['shot.view'], organization_memberships: [] },
      { permission: 'shot.view', prohibitedRoles: ['admin'] },
    );
    expect(result.current.isAllowed).toBe(true);
  });

  it('engine-explicit CRUD grants are honored for artist-coded roles', () => {
    const { result } = harness(
      {
        id: 'u2', role: 'artist', permissions: ['task.create'],
        organization_memberships: [{ organization_id: 'org1', role: 'artist', status: 'Active', permissions: ['task.create'] }],
      },
      { entityType: 'task', action: 'create', organizationId: 'org1' },
    );
    expect(result.current.isAllowed).toBe(true);
  });
});
```

(Adjust the AuthContext value shape to the real context type — read `src/core/auth/AuthContext.tsx` first; keep both assertions.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/permissions/__tests__/permissionControl.test.tsx`
Expected: FAIL (substring `includes('admin')` denies the first case; blanket artist ban denies the second).

- [ ] **Step 3: Implement**

```tsx
// Replace lines 83-91 (isArtist block):
const ARTIST_ROLE_CODES = new Set(['artist', 'lead_artist', 'vendor_artist', 'client_reviewer', 'client_viewer']);
const isArtist =
  ARTIST_ROLE_CODES.has(roleStr) &&
  !isBreakGlass &&
  !checkUserHasRole(auth.user, ['Organization Owner', 'org_owner']) &&
  !checkUserHasRole(auth.user, ['Organization Admin', 'org_admin']);
```

```tsx
// Line ~150 prohibitedRoles: exact match only
const isProhibited = prohibitedRoles.some((r) => r.toLowerCase() === roleStr);

// Line ~164 requiredRoles: exact match only (drop roleStr.includes fallback)
const hasReqRole = roleList.some((r) => auth.hasRole(r, organizationId));
```

```tsx
// Lines 138-145 artist CRUD ban: consult the engine first — explicit grants win
if (isArtist && isCrudOrBulkAction) {
  const engineProbe =
    permission ||
    (entityType && action ? `${entityType}.${action}` : null);
  const engineAllows = engineProbe
    ? storePermissions.can({
        permission: engineProbe,
        organizationId: organizationId || storePermissions.currentOrganizationId,
        projectId: projectId || storePermissions.activeProjectId,
      })
    : false;
  if (!engineAllows) {
    return { isAllowed: false, reason: unauthorizedTooltip || `Action restricted for role '${userRole}'.` };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/permissions/__tests__/permissionControl.test.tsx src/core/permissions/__tests__`
Expected: PASS. Then broader: `npx vitest run src/shared/components src/modules/tasks` (BulkActionBar/TaskBulk consumers).

- [ ] **Step 5: Commit**

```bash
git add src/core/permissions/PermissionControl.tsx src/core/permissions/__tests__/permissionControl.test.tsx
git commit -m "refactor: exact role matching + engine-first artist gate in PermissionControl"
```

### Task 6: M2 — Centralize engine break-glass chains (`user.role === ...` in engines)

**Files:**
- Modify: `src/core/permissions/scopeEngine.ts:194,550`, `resourceAuthorizationEngine.ts:45`, `fieldPermissionEngine.ts:130`, `bulkAuthorizationEngine.ts:69`, `workflowStateEngine.ts:211`, `externalAccessEngine.ts:94` (break-glass lines only — leave Client/Vendor/Lead-Artist domain branches at `externalAccessEngine.ts:473-634,742` and `scopeEngine.ts:128` for a follow-up; they encode external-isolation semantics, not admin elevation)
- Test: extend `canCanonical.test.ts` (break-glass parity case)

**Interfaces:**
- Consumes: new `isBreakGlass(user)` helper added to `rbac.ts` next to `isPlatformSuperuser`.
- Produces: one shared break-glass predicate; engines keep behavior, lose string chains.

- [ ] **Step 1: Add the shared helper + parity test**

```ts
// rbac.ts, next to isPlatformSuperuser
export function isBreakGlass(user: User | null): boolean {
  return isPlatformSuperuser(user);
}
```

```ts
// canCanonical.test.ts append
it('shared isBreakGlass matches inline chains', () => {
  const su = { ...user, is_superuser: true } as unknown as User;
  const owner = { ...user, is_superuser: false, role: 'Organization Owner' } as unknown as User;
  expect(isBreakGlass(su)).toBe(true);
  expect(isBreakGlass(owner)).toBe(false); // owner is NOT platform break-glass
});
```

Note: this intentionally narrows `user.role === 'Organization Owner'` OUT of break-glass — owners still pass via membership evaluation in each engine (verify per engine in Step 2; if any engine relied on the owner string for bypass, add an explicit `checkUserHasRole(user, ['Organization Owner','org_owner'])` branch there and name it).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/permissions/__tests__/canCanonical.test.ts`
Expected: FAIL (helper missing).

- [ ] **Step 3: Implement helper + replace the six break-glass lines**

```ts
// BEFORE (each engine)
if (user.is_superuser || user.role === 'Platform Admin' || user.role === 'Organization Owner') {
// AFTER
if (isBreakGlass(user)) {
```

with `import { isBreakGlass } from './rbac';` (or preserve the owner bypass explicitly where tests demand it — run engine-adjacent suites after each file).

- [ ] **Step 4: Run suites**

Run: `npx vitest run src/core/permissions src/routes/__tests__ src/modules/access`
Expected: PASS. Existing tests `externalAccessEngineStrictSuperuser.test.ts` and `isPlatformSuperuser.test.ts` must stay green — they pin this behavior.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "refactor: shared isBreakGlass predicate in permission engines"
```

### Task 7: M3 — Pin simulator stores to simulator UI (import boundary)

**Files:**
- Modify: `src/shared/stores/usePermissionStore.ts` (header doc only)
- Modify: `src/core/permissions/roleStore.ts` (header doc only)
- Test: `src/shared/stores/__tests__/simulatorBoundary.test.ts` (new)

**Interfaces:**
- Consumes: nothing at runtime — static source scan via `node:fs`.
- Produces: CI failure if any non-allowlisted file imports `usePermissionStore`/`useRoleStore`.

- [ ] **Step 1: Write the failing test**

```ts
// src/shared/stores/__tests__/simulatorBoundary.test.ts
import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';

const ALLOWLIST = new Set([
  'src/shared/components/PermissionsSimulatorModal.tsx',
  'src/modules/access/components/PermissionSimulatorSection.tsx',
  'src/core/permissions/index.ts',
]);

describe('simulator store boundary', () => {
  it('only simulator UI and barrels import the simulation stores', () => {
    const out = execSync(
      "grep -rln 'usePermissionStore\\|useRoleStore' src --include='*.ts' --include='*.tsx' | grep -v __tests__",
      { encoding: 'utf-8' },
    );
    const importers = out.trim().split('\n').map((s) => s.trim()).filter(Boolean);
    const violations = importers.filter(
      (f) =>
        !ALLOWLIST.has(f) &&
        !f.endsWith('usePermissionStore.ts') &&
        !f.endsWith('roleStore.ts'),
    );
    expect(violations).toEqual([]);
  });

  it('simulation defaults to OFF', async () => {
    const { usePermissionStore } = await import('@/shared/stores/usePermissionStore');
    expect(usePermissionStore.getState().isSimulating).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify current state**

Run: `npx vitest run src/shared/stores/__tests__/simulatorBoundary.test.ts`
Expected: PASS if no prod importers exist (verified: only `PermissionsSimulatorModal.tsx` imports it; `useRoleStore` has zero consumers — confirmed by grep). If it fails, the failure list IS the migration backlog: move each violator to session evaluation first, then re-run.

- [ ] **Step 3: Document simulator-only ownership (header comments)**

```ts
// top of usePermissionStore.ts (and mirrored in roleStore.ts)
/**
 * SIMULATOR ONLY — "what-if" role preview for PermissionsSimulatorModal /
 * PermissionSimulatorSection. NEVER import from production guards, tables,
 * switchers, or route components. Session truth lives in AuthProvider +
 * usePermissions() (see Task 7 boundary test). isSimulating defaults OFF.
 */
```

- [ ] **Step 4: Re-run + commit**

Run: `npx vitest run src/shared/stores/__tests__/simulatorBoundary.test.ts`
Expected: PASS.

```bash
git add src/shared/stores/usePermissionStore.ts src/core/permissions/roleStore.ts src/shared/stores/__tests__/simulatorBoundary.test.ts
git commit -m "chore: pin simulator stores to simulator UI with boundary test"
```

### Task 8: N3 — Verify platform Groups source, convert to read-only

**Files:**
- Read first: `src/core/masterData/useMasterData.ts` (`usePlatformGroups`, `useCreatePlatformGroup`, `useUpdatePlatformGroup`, `useDeletePlatformGroup`)
- Modify (likely): `src/modules/platform/admin/masterData/OrgStructure/GroupsSection.tsx`, `src/modules/platform/components/PlatformRolesTab.tsx:11,24,149`
- Test: existing `src/modules/platform/__tests__/adminSettingsTabs.test.tsx`

**Interfaces:**
- Consumes: verdict on whether `usePlatformGroups` reads the same org-groups API as `GroupsManagementSection` (`useGroups`) or a separate platform catalog.
- Produces: read-only catalog surface linking to `/access/groups`; `GroupsSectionHandle.openCreate` removed or repointed; `PlatformRolesTab` updated.

- [ ] **Step 1: Verify the data source**

Run: `grep -n "usePlatformGroups\|PLATFORM_GROUPS\|/groups" src/core/masterData/useMasterData.ts | head -20`
Expected: either a `/api/v1/.../groups` fetch (same source → full merge possible) or static/mock catalog (different source → read-only catalog + link).

- [ ] **Step 2a (same source): delete `GroupsSection`, embed access manager**

Replace `<GroupsSection>` in `PlatformRolesTab.tsx` with a link card to the canonical manager (`/access/groups` org-aware route) and delete the file. Update the test that renders platform tabs.

- [ ] **Step 2b (different source, expected): convert to read-only catalog**

Remove create/edit/delete modal + mutations from `GroupsSection.tsx`; render name/code/description/roles read-only with a banner: "Platform group templates — org access groups are managed in Access → Groups" + link. Change `GroupsSectionHandle` to `{}` (drop `openCreate`), update `PlatformRolesTab.tsx:24,149` ref usage. Keep `usePlatformGroups` read query.

- [ ] **Step 3: Run suite**

Run: `npx vitest run src/modules/platform`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "refactor: platform Groups surface read-only, access manager canonical (N3)"
```

### Task 9: Labels + governance docs (N5, Position label)

**Files:**
- Modify: `src/modules/organization/components/ProductionRoleSelect.tsx:30-38` (optgroup/label text "Production Role" → "Position"; keep component/file name to avoid churn)
- Create: `docs/access-control/SETTINGS-GOVERNANCE.md` (N5 rule)
- Test: `src/features/organizations/__tests__/pages/PersonRoleSelect.test.tsx` (update label assertions if any)

**Interfaces:**
- Consumes: nothing. Produces: UI text matching backend `Position`; written settings-ownership rule.

- [ ] **Step 1: Rename the visible label**

Run: `grep -rn "Production Role" src --include='*.tsx' | grep -v __tests__`
Expected: `ProductionRoleSelect.tsx` strings (+ maybe tab titles). Replace user-facing occurrences with "Position"; leave file/component/prop identifiers unchanged.

- [ ] **Step 2: Write the governance doc**

```markdown
# Settings Governance (N5)

- Typed `OrganizationSettings` (`organization_organization_settings`): fixed, well-known keys ONLY (locale, timezone, pipeline defaults, flags). Adding a key requires a migration + serializer + frontend type — deliberate by design.
- EAV `OrganizationSetting` (`organization_settings` + `SettingDefinition`): custom/extensible per-org keys. No migration needed; whoever defines the key documents it here.
- Rule: if a setting needs validation, filtering, or a dedicated UI control → typed model. If it is free-form or experimental → EAV. Never both for the same key.
```

Save to `docs/access-control/SETTINGS-GOVERNANCE.md`.

- [ ] **Step 3: Run suite + commit**

Run: `npx vitest run src/features/organizations src/modules/organization`
Expected: PASS.

```bash
git add -A && git commit -m "chore: Position labeling + settings governance doc"
```

### Task 10: Full validation + metrics

**Files:** none (verification only)

- [ ] **Step 1: Typecheck**

Run: `npm run typecheck` (i.e. `tsc --noEmit`)
Expected: zero errors.

- [ ] **Step 2: Lint**

Run: `npx biome check src`
Expected: zero errors (warnings acceptable if pre-existing; compare against `main`).

- [ ] **Step 3: Unit suite + contract validation**

Run: `npm run test` then `npm run api:validate`
Expected: all green; contract validation unchanged (no API changes in this plan).

- [ ] **Step 4: Playwright consolidation + isolation specs (needs Django at `VITE_API_URL`)**

Run: `npx playwright test e2e/consolidation.spec.ts e2e/organization-isolation.spec.ts e2e/route-authorization.spec.ts`
Expected: PASS. If no backend is reachable, record "blocked: no Django" and do not mark the plan done.

- [ ] **Step 5: Re-measure duplication metrics**

Run: `find src -type f | wc -l; grep -rn "isUserAdmin\|from './rbac'" src --include='*.ts' --include='*.tsx' | grep -v __tests__ | grep -v "hasElevatedAccess\|isBreakGlass\|checkUserHas\|evaluateUser\|isPlatformSuperuser\|getUserMembership\|hasElevatedAccess"`
Expected: file count ≤ 757 boundary baseline minus conversions (expect −1 from Task 8 variant 2a, else equal); legacy `can`/`isUserAdmin` imports only in `rbac.ts` itself.

## Out of scope (Phase 1 backend handoff, separate session in `../studiohub`)

N1 `Person.user` FK + email-match migration; N2 status choices; N7 `role_ref` FK; N8 table rename; serializer/selector/filterset updates; `pytest backend/apps/{organization,production,identity,audit}`. After Phase 1 lands, a small follow-up here wires `Person.user_id`/`role_ref` into `types/identity.ts` + selectors — do not pre-build it against an imagined contract.

## Self-review

- Spec coverage: M1→Tasks 1–2, M2→Tasks 3–6, M3→Task 7, N3→Task 8, N5+label→Task 9, validation→Task 10, N4/N6 keep-decisions need no code, N1/N2/N7/N8→out-of-scope handoff. §18 "preserve" list enforced via Global Constraints + existing suites + Playwright gate.
- Placeholder scan: every step has exact code/commands; call-site files carry verified line numbers with a re-grep step where drift is possible; the two Task 5/3 test harnesses name the file to read for shape alignment instead of guessing.
- Type consistency: `hasElevatedAccess(user, organizationId?)`, `isBreakGlass(user)`, `can(user, CanQuery)`, `legacyCanArgs(permission, context)` used identically across tasks; `PermissionEvaluationContext` imported from `@/types/identity` everywhere.
- Review Focus: five items each pinned to Task 1 (hostile code), Task 5 (artist grant + prohibited exactness), Task 7 (simulator leakage + future imports), Task 8 (`openCreate` ref).
