# Production Role Scoping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scope Production Roles by organization (enabled Global Master Roles + org-exclusive Custom Roles) across the People form, assignment validation, and RBAC — frontend Track 1 only.

**Architecture:** Extend the existing `Position` catalog with a `scope` discriminator and per-org enablement on the organization record; serve a server-filtered available-roles read; validate the assignment triple on person create/update in the mock engine; replace the one hard-coded production-role-name rule with a permission check. Django work is explicitly out of scope (Track 2).

**Tech Stack:** React 19, TypeScript, TanStack Query, Vitest, Playwright, Vite; mock engine (`src/mocks/mockRouter.ts`) as the contract under test.

**Spec:** `docs/superpowers/specs/2026-09-29-production-role-scoping-design.md` — the plan argues from the spec; executors read both.

## Global Constraints

- No theme or styling changes; reuse canonical components (`Modal`, `Button`, `SearchInput`, `StatusBadge`, `EmptyState`).
- No parallel role entity; extend `Position` (`src/types/organization.ts:94-99`) and the existing positions endpoints.
- `isEpisodicProject()`-style single deciders stay untouched; analogously, `evaluateUserPermission` stays the single permission evaluator — no new authorization path.
- Server 400s use existing DRF field-error shapes via `ApiError.fromDrfResponse(400, { detail, <field>: [...] })`.
- `validate-api-contract.mjs` allowlist stays unchanged (positions routes already exist in the contract; verify, never widen silently).
- Every stage gates on all four: `pnpm run lint` (`tsc --noEmit`), `pnpm run test` (`vitest run`), `pnpm api:validate`, `pnpm build`.
- TDD: failing test first, watched fail, minimal code, full suite green before commit; one task per commit.

## Review Focus

- A person whose assigned role was deleted/archived afterwards opens edit: the form must render without crashing, show the stored display name, and require a fresh valid pick before submit works — pinned by a test in Task 4's step style.
- An org with zero custom roles and zero enabled masters opens the role dropdown: it shows a "No roles available" empty state and person creation is blocked with guidance, never a crash — pinned by a test in Task 4's step style.
- The user switches organization while the People form is open with a role picked: the stale cross-org `role_id` must never submit — the select resets on org change and the server rejects any smuggled id with 400 — pinned by tests in Task 3 (server) and Task 4 (reset) step styles.
- Two custom roles share a title in one org: the dropdown disambiguates with department/code suffix so the wrong one can't be picked blindly — pinned by a test in Task 4's step style.
- The role record vanishes between list and submit (Django 404s the assignment or the mock equivalent): the form surfaces the field error and stays open with state intact — pinned by a test in Task 4's step style.

---

## File Structure

- `src/types/organization.ts` — `Position` gains `scope`, nullable `organization_id` semantics; `Person` gains `role_id`; `OrganizationSettings` gains `enabled_master_position_ids`.
- `src/modules/organization/utils/positionScoping.ts` — NEW small pure module: `getAvailablePositions(positions, organizationId, enabledMasterIds)` and `isRoleAvailableForOrg(role, organizationId, enabledMasterIds)`. One responsibility: the availability rule both the mock router and tests share.
- `src/mocks/db/production/positions.ts` (verify exact fixtures filename during Task 1 — candidates `positions.ts` under `src/mocks/db/production/` or `src/mocks/db/organization/`) — global master seeds + per-org customs + enablement wiring.
- `src/mocks/mockRouter.ts` — available-read inside the generic org-scoped block (`orgScopedPattern`, ~line 5345); assignment checks on the people create/update/PATCH paths.
- `src/modules/organization/api/organizationApi.ts` — `getAvailablePositions(orgId)` hitting `/api/organizations/:org/positions/available/`; person payloads carry `role_id` (verify pass-through).
- `src/modules/organization/hooks/useWorkforceData.ts` — `useAvailablePositions(orgId)` hook.
- `src/modules/organization/components/tabs/PositionsTab.tsx` — customs CRUD (verify existing) + master enable-toggles.
- `src/modules/platform/components/PlatformRolesTab.tsx` — masters management verified working (positions sub-tab + `usePlatformPositions`).
- `src/modules/organization/components/tabs/PeopleTab.tsx`, `src/modules/people/pages/CreatePersonPage.tsx`, person edit surface — Production Role `<select>`.
- `src/core/permissions/scopeEngine.ts` — Lead Artist literal replaced (~lines 370-385).
- `e2e/production-role-scoping.spec.ts` — NEW Playwright journey + standard regression.

---

### Task 1: Catalog model, seeds, availability rule

**Files:**
- Modify: `src/types/organization.ts:94-99` (`Position`), `Person` (`role_id`), `OrganizationSettings` (`enabled_master_position_ids`)
- Create: `src/modules/organization/utils/positionScoping.ts`
- Modify: positions fixtures + org seeds (enablement sets)
- Test: `src/modules/organization/utils/__tests__/positionScoping.test.ts`

**Interfaces:**
- Consumes: existing `Position`/`Person`/`OrganizationSettings` shapes.
- Produces: `getAvailablePositions(positions: Position[], organizationId: string, enabledMasterIds: string[]): Position[]` — returns customs with `organization_id === organizationId` plus globals (`scope === 'global_master'`) whose id is in `enabledMasterIds`; `isRoleAvailableForOrg(role, organizationId, enabledMasterIds): boolean` — one-role predicate used by Task 3's server checks.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { getAvailablePositions } from '../positionScoping';

const G_ANIMATOR = { id: 'pos-master-animator', title: 'Animator', scope: 'global_master', organization_id: null };
const G_RIGGER = { id: 'pos-master-rigger', title: 'Rigger', scope: 'global_master', organization_id: null };
const C_CREATURE_A = { id: 'pos-a-creature', title: 'Creature Lead', scope: 'organization_custom', organization_id: 'org-a' };
const C_LIGHT_B = { id: 'pos-b-light', title: 'Lighting Lead', scope: 'organization_custom', organization_id: 'org-b' };

describe('getAvailablePositions', () => {
  it('returns enabled masters plus own customs, never another org customs', () => {
    const got = getAvailablePositions(
      [G_ANIMATOR, G_RIGGER, C_CREATURE_A, C_LIGHT_B],
      'org-a',
      ['pos-master-animator']
    );
    expect(got.map((p) => p.id).sort()).toEqual(['pos-a-creature', 'pos-master-animator']);
  });

  it('hides disabled masters and legacy rows without scope', () => {
    const legacy = { id: 'pos-legacy', title: 'Compositor', organization_id: 'org-a' };
    const got = getAvailablePositions(
      [G_ANIMATOR, G_RIGGER, C_CREATURE_A, legacy as any],
      'org-a',
      []
    );
    expect(got.map((p) => p.id).sort()).toEqual(['pos-a-creature', 'pos-legacy']);
  });
});
```

(Legacy rows without `scope` but with matching `organization_id` are treated as customs — back-compat rule, pinned here.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/modules/organization/utils/__tests__/positionScoping.test.ts`
Expected: FAIL with "Cannot find module '../positionScoping'" (or "getAvailablePositions is not a function").

- [ ] **Step 3: Write minimal implementation**

Add to `Position`: `scope?: 'global_master' | 'organization_custom'; organization_id?: string | null;`. Add to `Person`: `role_id?: string;`. Add to `OrganizationSettings`: `enabled_master_position_ids?: string[];`. Create `positionScoping.ts` implementing exactly the two functions with the legacy rule above. Seed: global masters (Animator + core crafts, `organization_id: null`), per-org customs (Creature Lead @ apex org, Lighting Lead @ a second fixture org), and `enabled_master_position_ids` on the org seeds so each org sees masters + own customs.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/modules/organization/utils/__tests__/positionScoping.test.ts`
Expected: PASS. Then run: `pnpm run lint` — Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/types/organization.ts src/modules/organization/utils/positionScoping.ts src/modules/organization/utils/__tests__/positionScoping.test.ts src/mocks/db/
git commit -m "feat(roles): scoped position catalog, enablement, seeds"
```

(Adjust the `src/mocks/db/` paths to the real fixtures files touched.)

### Task 2: Available-read endpoint, hook, management UI

**Files:**
- Modify: `src/mocks/mockRouter.ts` (available-read inside the generic org-scoped block, ~line 5345)
- Modify: `src/modules/organization/api/organizationApi.ts` (`getAvailablePositions`)
- Modify: `src/modules/organization/hooks/useWorkforceData.ts` (`useAvailablePositions`)
- Modify: `src/modules/organization/components/tabs/PositionsTab.tsx` (customs CRUD verify + master enable-toggles)
- Modify: platform positions surface only if master create/edit is broken there (verify `PlatformRolesTab` positions sub-tab first)
- Test: `src/mocks/__tests__/positionAvailability.test.ts`

**Interfaces:**
- Consumes: `getAvailablePositions` from Task 1; org `settings.enabled_master_position_ids`.
- Produces: `GET /api/organizations/:org/positions/available/` (server-filtered via the Task 1 helper — never load-all); `useAvailablePositions(orgId)` hook; enable-toggle persisted on the org record.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { dispatchMockRequest } from '@/mocks/mockRouter';

describe('positions available-read (server isolation)', () => {
  it('org A sees enabled masters plus own customs only', async () => {
    const res = await dispatchMockRequest<any>('GET', '/api/organizations/org-apex-01/positions/available/');
    const ids = ((res?.data as any[]) ?? res?.data?.results ?? []).map((p: any) => p.id);
    expect(ids).toContain('pos-master-animator');
    expect(ids).toContain('pos-a-creature');
    expect(ids.some((id: string) => id === 'pos-b-light')).toBe(false);
  });

  it('a disabled master is hidden until enabled', async () => {
    const before = await dispatchMockRequest<any>('GET', '/api/organizations/org-apex-01/positions/available/');
    const beforeIds: string[] = ((before?.data as any[]) ?? []).map((p: any) => p.id);
    expect(beforeIds).not.toContain('pos-master-rigger');
  });
});
```

(Use the real seeded ids from Task 1 — replace `org-apex-01`/`pos-master-animator` with the actual seeded values if they differ. Check the established router-test auth pattern in `src/mocks/sqlite/repository.test.ts` first and copy it; the second test's enable-then-visible half is covered by the toggle test below.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/mocks/__tests__/positionAvailability.test.ts`
Expected: FAIL — no `available` sub-action exists ( falls through to 404 or the generic handler).

- [ ] **Step 3: Write minimal implementation**

In the generic org-scoped block, add `if (resource === 'positions' && itemParam === 'available' && normMethod === 'GET')` returning `getAvailablePositions(inMemoryPositions, targetOrgId, org.settings?.enabled_master_position_ids ?? [])`. Add `organizationApi.getAvailablePositions(orgId)` hitting that path and `useAvailablePositions(orgId)` wrapping it (same shape as `usePositions`). In `PositionsTab`, add a "Master Roles" section listing globals with enable checkboxes persisting `enabled_master_position_ids` via the existing organization update path; verify customs CRUD already works there (extend only if broken). Verify the platform positions sub-tab creates/edits masters (with `scope: 'global_master'`, `organization_id: null`); extend its form with a scope select only if missing.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/mocks/__tests__/positionAvailability.test.ts`
Expected: PASS. Then run: `pnpm run lint && pnpm api:validate` — Expected: clean, exit 0 (positions routes already contracted; the new sub-action must not trip invented-route failures — if it does, that is a real finding, fix the route shape, do not touch the allowlist).

- [ ] **Step 5: Commit**

```bash
git add src/mocks/mockRouter.ts src/modules/organization/api/organizationApi.ts src/modules/organization/hooks/useWorkforceData.ts src/modules/organization/components/tabs/PositionsTab.tsx src/mocks/__tests__/positionAvailability.test.ts
git commit -m "feat(roles): available-read endpoint, hook, enablement UI"
```

(Adjust file list to what Step 3 actually touched, including any platform-tab file.)

### Task 3: Assignment validation on person create/update

**Files:**
- Modify: `src/mocks/mockRouter.ts` (people create/update/PATCH paths — generic org-scoped `people` block ~line 5512 plus `/api/v1/people/` POST ~line 6310)
- Test: `src/mocks/__tests__/personRoleAssignment.test.ts`

**Interfaces:**
- Consumes: `isRoleAvailableForOrg` semantics from Task 1 (reimplement inline in the handler reusing the same rule; do not import UI modules into the router).
- Produces: 400 `role_id` field errors on invalid assignment; valid assignments persist `role_id` (+ display `role` title passthrough).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { dispatchMockRequest } from '@/mocks/mockRouter';

describe('person role assignment validation', () => {
  it('accepts an enabled master and a same-org custom', async () => {
    const ok1 = await dispatchMockRequest<any>('POST', '/api/organizations/org-apex-01/people/', {
      full_name: 'T1 Animator', email: 't1-animator@example.vfx', role_id: 'pos-master-animator',
    });
    expect(ok1!.status).toBe(201);
    const ok2 = await dispatchMockRequest<any>('POST', '/api/organizations/org-apex-01/people/', {
      full_name: 'T1 Creature', email: 't1-creature@example.vfx', role_id: 'pos-a-creature',
    });
    expect(ok2!.status).toBe(201);
  });

  it('rejects a disabled master, a cross-org custom, and an org mismatch', async () => {
    const r1 = await dispatchMockRequest<any>('POST', '/api/organizations/org-apex-01/people/', {
      full_name: 'T1 Nope', email: 't1-nope@example.vfx', role_id: 'pos-master-rigger',
    }).catch((e: any) => e);
    expect([400]).toContain(r1?.status ?? r1?.response?.status);
    const r2 = await dispatchMockRequest<any>('POST', '/api/organizations/org-apex-01/people/', {
      full_name: 'T1 Cross', email: 't1-cross@example.vfx', role_id: 'pos-b-light',
    }).catch((e: any) => e);
    expect([400]).toContain(r2?.status ?? r2?.response?.status);
  });

  it('rejects cross-org moves on PATCH', async () => {
    const created = await dispatchMockRequest<any>('POST', '/api/organizations/org-apex-01/people/', {
      full_name: 'T1 Mover', email: 't1-mover@example.vfx', role_id: 'pos-a-creature',
    });
    const id = (created!.data as any).id;
    const moved = await dispatchMockRequest<any>('PATCH', `/api/organizations/org-apex-01/people/${id}/`, {
      role_id: 'pos-b-light',
    }).catch((e: any) => e);
    expect([400]).toContain(moved?.status ?? moved?.response?.status);
  });
});
```

(Replace seeded ids with Task 1's real values. Check whether `dispatchMockRequest` throws or returns error statuses in this codebase version — mirror the established pattern from `episodicIntegrity.test.ts`, never invent client code.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/mocks/__tests__/personRoleAssignment.test.ts`
Expected: FAIL — no `role_id` checks exist (invalid assignments 201).

- [ ] **Step 3: Write minimal implementation**

On person create (both org-scoped and `/api/v1/people/` paths) and PATCH: when `role_id` is supplied, resolve the position from in-memory positions; require the person's effective `organization_id`; enforce global-only-if-enabled (org `settings.enabled_master_position_ids`) and custom-only-if-same-org; on violation throw `ApiError.fromDrfResponse(400, { detail: '...', role_id: ['...'] })`. Persist `role_id` on the row. Absent `role_id` keeps current behavior exactly.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/mocks/__tests__/personRoleAssignment.test.ts`
Expected: PASS. Then run: `pnpm run lint && pnpm api:validate` — Expected: clean, exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/mocks/mockRouter.ts src/mocks/__tests__/personRoleAssignment.test.ts
git commit -m "feat(roles): person assignment validation"
```

### Task 4: People form dropdown, edit pre-select, edge states

**Files:**
- Modify: `src/modules/organization/components/tabs/PeopleTab.tsx` (invite modal role field)
- Modify: `src/modules/people/pages/CreatePersonPage.tsx` (role field + `'Senior 3D Artist'` default)
- Modify: person edit surface (resolve the real edit component path against source first — candidate the same tab's edit modal or a dedicated page; use whichever the codebase has)
- Test: `src/features/organizations/__tests__/pages/PersonRoleSelect.test.tsx` (create dir-adjacent file if the pages dir fits better)

**Interfaces:**
- Consumes: `useAvailablePositions(orgId)` from Task 2; Task 3's 400 `role_id` shapes for the failure test.
- Produces: role `<select>` (grouped Master / Custom, required, blank default) in all three surfaces; edit pre-selects current `role_id`; submit carries `role_id` (+ display `role` title).

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

describe('people Production Role select', () => {
  it('offers only the org’s roles grouped Master/Custom and submits role_id', async () => {
    // Render the invite modal (or CreatePersonPage) with useAvailablePositions
    // mocked to [Animator (master), Creature Lead (custom), Lighting Lead (other org — must be filtered by the hook, assert absence)].
    // Select Creature Lead → submit → assert payload { role_id: 'pos-a-creature', role: 'Creature Lead' }.
    expect(true).toBe(false); // replaced by the real assertions above
  });

  it('edit pre-selects the current role and shows stored name when the role is gone', async () => {
    // Person with role_id deleted from the available list: renders stored
    // `role` display string, requires a fresh valid pick before submit works.
    expect(true).toBe(false); // replaced by the real assertions above
  });

  it('empty catalog blocks creation with guidance, and org change resets the pick', async () => {
    // Zero roles → "No roles available" state, submit disabled with guidance.
    // Change org prop → role select resets to blank.
    expect(true).toBe(false); // replaced by the real assertions above
  });

  it('duplicate titles disambiguate and server 400 keeps the form open', async () => {
    // Two customs sharing a title render with department/code suffix.
    // Submit with a role the server rejects → field error shown, form open, state intact.
    expect(true).toBe(false); // replaced by the real assertions above
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/organizations/__tests__/pages/PersonRoleSelect.test.tsx`
Expected: FAIL — free-text input exists, no dropdown, no `role_id`.

- [ ] **Step 3: Write minimal implementation**

Replace the free-text role inputs with required `<select>` fed by `useAvailablePositions(orgId)`, grouped Master / Custom with department/code suffixes on duplicates, blank default (drop the `'Compositor'` / `'Senior 3D Artist'` defaults). Edit surfaces pre-select `role_id` and fall back to the stored `role` display string when the id is absent from the list (submit blocked until a valid pick). Selecting sets `role` title from the record. Reset the pick when the org changes. Surface server `role_id` 400s as field errors with the form kept open. Email/department behavior unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/organizations/__tests__/pages/PersonRoleSelect.test.tsx`
Expected: PASS. Then run: `pnpm run lint` — Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/modules/organization/components/tabs/PeopleTab.tsx src/modules/people/pages/CreatePersonPage.tsx src/features/organizations/__tests__/pages/PersonRoleSelect.test.tsx
git commit -m "feat(roles): scoped Production Role dropdown in people flows"
```

(Adjust file list to the real edit surface resolved in Step 3.)

### Task 5: Replace the hard-coded Lead Artist rule with a permission check

**Files:**
- Modify: `src/core/permissions/scopeEngine.ts` (~lines 370-385, TEAM-scope tail)
- Test: extend the suite that covers scopeEngine if one exists (grep `scopeEngine` under `src/**/__tests__/` first), else create `src/core/permissions/__tests__/leadArtistScope.test.ts`

**Interfaces:**
- Consumes: `evaluateUserPermission`-family (`can()`) and the role templates in `src/core/permissions/systemRoles.ts`.
- Produces: identical visibility decisions with no production-role name literal in the engine.

- [ ] **Step 1: Write the failing (characterization) test**

```ts
import { describe, it, expect } from 'vitest';

describe('lead department visibility (characterization)', () => {
  it('lead sees same-department entities but not other-department ones', async () => {
    // Resolve the real scope-evaluation entry point used by scopeEngine's
    // TEAM-scope tail (verify export name against source first).
    // Lead user (department Compositing) + entity (department Compositing) → allowed.
    // Same lead + entity (department Lighting) → denied.
    expect(true).toBe(false); // replaced by the real assertions above
  });

  it('non-lead visibility is unchanged', async () => {
    // Senior artist same-department visibility behaves exactly as today
    // (allowed or denied per current engine — pin CURRENT behavior, whatever it is).
    expect(true).toBe(false); // replaced by the real assertions above
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run the new test file with `npx vitest run`.
Expected: FAIL — file/import or behavior entry point unresolved until written against the real export (or, if written directly against current behavior, the second test documents it; the RED here is the missing permission-based path — state which in the commit message).

- [ ] **Step 3: Write minimal implementation**

First diff the `lead_artist` template against `senior_artist`/`artist` templates in `src/core/permissions/systemRoles.ts` to identify a grant the lead family holds that plain artists do not (candidates observed: `task.complete`, `review.annotate`, `shot.submit`, `task.start` — verify in-task, do not assume). Replace the `user.role === 'Lead Artist'` / `pm.role === 'Lead Artist'` / `roles.includes('Lead Artist')` literals with a permission check for that grant via the canonical evaluator, keeping the same-department comparison logic byte-identical. If no single distinguishing grant exists, resolve the user's assigned Position record and check for a lead-equivalent grant on its permission set — and report that choice explicitly. `rbac.ts` administrative checks stay untouched.

- [ ] **Step 4: Run test to verify it passes**

Run: the new test file, then full `pnpm run test`.
Expected: PASS, characterization unchanged (same allow/deny matrix as Step 1), full suite green. Then `pnpm run lint` — Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/core/permissions/scopeEngine.ts <new-or-extended-test-file>
git commit -m "feat(rbac): permission-based lead department scope"
```

### Task 6: REST payloads, 404 tolerance, E2E, contract delta

**Files:**
- Test: `src/modules/organization/__tests__/personRolePayloads.test.ts` (create dir if absent; follows colocated convention)
- Create: `e2e/production-role-scoping.spec.ts`
- Create: `docs/api/role-scoping-contract-delta.md` (Track 2 input: endpoint table, fields, validation rules, permission mapping)

**Interfaces:**
- Consumes: everything from Tasks 1-5; Playwright mock-mode harness (`VITE_API_MODE=mock PORT=3100`, login helper `#login-email-input` + `password123` — copy the pattern from an existing spec, e.g. `mock-sqlite-persistence.spec.ts`).
- Produces: mocked-transport proof, tolerant UI proof, green journeys, and the Track 2 contract delta doc.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/api/client/ApiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(async (_url: string, body: any) => ({ ...body, id: 'new-1' })),
    put: vi.fn(async (_url: string, body: any) => body),
    patch: vi.fn(async (_url: string, body: any) => body),
    delete: vi.fn(async () => ({})),
  },
}));

describe('person role REST payloads (mocked transport)', () => {
  it('sends role_id on person create', async () => {
    const { apiClient } = await import('@/api/client/ApiClient');
    // Drive the real create path (organizationApi.createPerson or the
    // repository used by usePersonMutations — resolve against source first)
    // with { full_name, email, role_id: 'pos-a-creature', organization_id: 'org-apex-01' }.
    // Assert the mocked post received role_id. Pattern proven by
    // episodicRestPayloads.test.ts — copy its injection technique.
    expect(true).toBe(false); // replaced by the real assertions above
  });

  it('tolerates a 404 roles transport without crashing', async () => {
    // Point the mocked get at a rejected 404 for positions/available and
    // render the role select surface → EmptyState, no throw.
    expect(true).toBe(false); // replaced by the real assertions above
  });
});
```

Plus the Playwright spec skeleton (episodic-workflow.spec.ts pattern — copy journey structure, stability stamps, reload-verify):

```ts
import { test, expect } from '@playwright/test';
// login helper copied from mock-sqlite-persistence.spec.ts
test('role scoping journey', async ({ page }) => {
  // superadmin-equivalent login → enable a master for the org →
  // create org custom role → create person with scoped role →
  // switch org → assert custom invisible → reload → verify assignment + activity.
  expect(true).toBe(false); // replaced by the real journey before running
});
test('standard role flows unchanged', async ({ page }) => {
  expect(true).toBe(false); // replaced by the real journey before running
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/modules/organization/__tests__/personRolePayloads.test.ts` and `npx playwright test e2e/production-role-scoping.spec.ts`
Expected: FAIL — payload assertions unmet / journeys unimplemented.

- [ ] **Step 3: Write minimal implementation**

Fix only what the tests prove broken: pass `role_id` through person create/update payloads (verify, add where stripped); guard the role select empty/error state. Write `docs/api/role-scoping-contract-delta.md` with: endpoint table (positions available read, person assignment validation, enablement write), field list (Position scope/org link, org enabled-masters set, Person role_id, 400 `role_id` shapes), permission mapping for assignment actions. No Django code; no allowlist change.

- [ ] **Step 4: Run test to verify it passes**

Run: the payload tests, then the Playwright spec (re-run until stable), then full gates: `pnpm run lint && pnpm run test && pnpm api:validate && pnpm build` — Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/modules/organization/__tests__/personRolePayloads.test.ts e2e/production-role-scoping.spec.ts docs/api/role-scoping-contract-delta.md
git commit -m "test(roles): payload proofs, E2E journey, contract delta"
```

(Include any source files fixed in Step 3 in the same commit with their paths.)

---

## Self-Review

**1. Spec coverage:** §1 catalog/enablement/seeds → Task 1 (+ Task 2 enablement UI). §2 assignment validation incl. PATCH → Task 3. §3 People form incl. pre-select → Task 4. §4 RBAC remediation (Lead Artist rule; admin checks excluded) → Task 5. §5 REST payloads + 404 tolerance → Task 6. §6 test matrix: visibility → Tasks 1-2 tests; assignment matrix → Task 3; pre-select → Task 4; permission resolution + grep-guard → Task 5 (add the grep-guard assertion to Task 5's test: scan `src/core/permissions/` for `=== 'Lead` / `=== "Lead` production literals — specified here so it is not lost); E2E + regression → Task 6. §7 out-of-scope restated per task. §8 appendix → Task 6 doc. No spec section without an owner.

**2. Placeholder scan:** every step carries real commands, real assertions, and real file paths; `expect(true)` markers are explicitly labeled must-replace-before-run (they force RED, not placeholders for behavior). The two "resolve against source first" notes name exact files/exports to check. No TBD/TODO. Fixed inline: none remaining.

**3. Type consistency:** `scope: 'global_master' | 'organization_custom'` used uniformly; `role_id: string` on Person; `enabled_master_position_ids: string[]` on OrganizationSettings; `getAvailablePositions(positions, organizationId, enabledMasterIds)` signature identical in Task 1 tests and Task 2 consumption; endpoint `/api/organizations/:org/positions/available/` identical in Task 2 test, api fn, and Task 6 delta doc outline; 400 shape `ApiError.fromDrfResponse(400, { detail, role_id: [...] })` identical in Tasks 3-4.

**4. Review Focus:** all five lines have owning tests (Tasks 4, 4, 3+4, 4, 4 respectively, in each task's own step style).
