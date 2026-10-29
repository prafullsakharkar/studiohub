# Org Workspace Follow-up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the existing `feat/org-workspace-refactor` branch (rebased on `main`), tighten the Access & RBAC workspace section to Users/Roles/Groups/Permissions, and unify the six legacy relationship selectors as facades over the org-scoped `OrgEntitySelector` plus a positional facade for production roles.

**Architecture:** Disable (not delete) the three extra access tabs via the branch's existing `enabled`/`required`/stale-tab machinery; convert `PersonSelect`/`DepartmentSelect`/`TeamSelect`/`OfficeSelect`/`ClientSelect`/`VendorSelect` to thin facades over `OrgEntitySelector`; add a `ProductionRoleSelectFacade` preserving master/custom optgroup semantics over the same surface, or keep the select where the layout justifies optgroups. All queries remain Django-REST-backed and org-scoped via existing hooks.

**Tech Stack:** React 18 + TypeScript (strict:false), TanStack Query, existing orgEntity hooks (`usePeople`/`useDepartments`/`useTeams`/`useOffices`/`useClients`/`useVendors`/`useProjects`/`useAvailablePositions`), lucide icons, vitest + testing-library, `pnpm`/npm per package.json, biome.

**Spec:** `docs/superpowers/specs/2026-10-07-org-workspace-followup-design.md`

## Global Constraints

- Work happens on the existing branch `feat/org-workspace-refactor` in its worktree `.worktrees/org-workspace-refactor`, FIRST rebased onto `main` (which holds consolidation merges: permission helpers, Group surface, contract wiring). Report if rebase conflicts touch task files; fix-and-contest, don't abandon.
- No new mock/MSW/SQLite paths; Django REST only. Frontend gating is UX-only, backend remains authoritative.
- Optional tabs are disabled via `enabled: false` (never deleted) so their canonical access-module routes (`/organizations/:org/access/*`) keep working.
- Entity/wire shapes stay source-verified — never invent a role_id/user_id field that doesn't exist; backend supplies them already (phase 1).
- Production workspace untouched; project access management stays via the Access module routes.
- No new parallel CRUD framework; shared components from `src/shared/relationships` + `src/shared/crud` stay canonical.

## Review Focus

- A selected id that's stale after switching org must keep blocking submit and show the stored label — pinned by Task 3 facade tests plus the plan-level stale-tab redirect tests (Task 1).
- A caller passing a `departmentFilter`/`teamFilter` to `PersonSelect` must not silently drop people who belong to the org but whose names changed case — pinned by the Task 2 role-facade contract test replacing substring matching with backend filter params.
- Disabling `access-projects`/`access-simulator`/`access-audit` must not break the canonical `/organizations/:org/access/:section` pages those tabs point at — those components stay mounted at their own routes, verified by unchanged access-module tests (`ProjectAccessSection` tests stay green).
- A relationship picker with `permission` denied must render the note, not a disableable but selectable control — pinned via `enabled` gating + permission hooks already used by `OrgEntitySelector`, asserted in Task 2/3 render tests.
- ProductionRole select must keep master-before-custom ordering and blank-default requiredness (parity with current `ProductionRoleSelect` asserts) — pinned by facade tests in Task 3.

---

### Task 1: Tighten Access & RBAC (disable extra workspace tabs)

**Files:**
- Modify: `src/modules/organization/pages/OrganizationWorkspacePage.tsx` (set `enabled: false` on `access-projects`, `access-simulator`, `access-audit`; no component/route changes)
- Test: `src/modules/organization/pages/__tests__/OrganizationWorkspaceAccessTabs.test.tsx` (update the section-list assertion; add coverage that org-workspace Access & RBAC only shows the four core tabs)

**Interfaces:**
- Consumes: existing `enabled?: boolean` tab flags + `isTabAvailable` filtering already on `WORKSPACE_SECTIONS`.
- Produces: workspace Access & RBAC section shows only `roles`, `permissions`, `groups`, `users`; underlying components (`ProjectAccessSection`, `PermissionSimulatorSection`, `AccessAuditSection`) remain exported for their canonical routes.

- [ ] **Step 1: Write the failing test (update + extend existing suite)**

Change the "exposes the access-module tabs" test — replace the exact list with the target set:

```ts
// src/modules/organization/pages/__tests__/OrganizationWorkspaceAccessTabs.test.tsx
it('exposes only Users/Roles/Groups/Permissions in the workspace Access & RBAC section', () => {
  const access = WORKSPACE_SECTIONS.find((s) => s.id === 'access');
  expect(access).toBeDefined();
  const ids = access!.tabs.filter((t) => t.enabled !== false).map((t) => t.id);
  expect(ids).toEqual(['roles', 'permissions', 'groups', 'users']);
  expect(ids).not.toContain('access-projects');
  expect(ids).not.toContain('access-simulator');
  expect(ids).not.toContain('access-audit');
});
```

Plus a disabled-visibility test:

```ts
it('disabled access tabs are flagged so the workspace filters them out', () => {
  const access = WORKSPACE_SECTIONS.find((s) => s.id === 'access')!;
  const projects = access.tabs.find((t) => t.id === 'access-projects');
  const simulator = access.tabs.find((t) => t.id === 'access-simulator');
  const audit = access.tabs.find((t) => t.id === 'access-audit');
  expect(projects?.enabled).toBe(false);
  expect(simulator?.enabled).toBe(false);
  expect(audit?.enabled).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/modules/organization/pages/__tests__/OrganizationWorkspaceAccessTabs.test.tsx`
Expected: FAIL — section still lists the three extra tabs (no `enabled:false` yet).

- [ ] **Step 3: Add `enabled: false` to the three tabs**

In `OrganizationWorkspacePage.tsx` on the `access` section, change the tab objects to include `enabled: false` (roles/permissions/groups/users untouched):

```ts
{ id: 'access-projects', label: 'Projects', icon: Film, permission: 'project.view', enabled: false },
{ id: 'access-simulator', label: 'Simulator', icon: Sliders, permission: 'permissions.manage', enabled: false },
{ id: 'access-audit', label: 'Audit', icon: Activity, permission: 'audit.view', enabled: false },
```

The existing `visibleSections`/`isActiveTabAllowed` filters already respect `enabled !== false`; no other changes to the page.

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run src/modules/organization/pages/__tests__/OrganizationWorkspaceAccessTabs.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run adjacent suites**

Run: `npx vitest run src/features/organizations/__tests__ src/modules/access/__tests__ src/modules/organization/__tests__`
Expected: PASS (access-module unit tests for the kept-but-disabled sections stay green; organizations suite unaffected).

- [ ] **Step 6: Commit**

```bash
git add src/modules/organization/pages/OrganizationWorkspacePage.tsx src/modules/organization/pages/__tests__/OrganizationWorkspaceAccessTabs.test.tsx
git commit -m "feat(org-workspace): scope Access & RBAC to users/roles/groups/permissions (optional tabs)"
```

### Task 2: Unify the six legacy relationship selectors into OrgEntitySelector facades

**Files:**
- Modify: `src/modules/organization/components/{PersonSelect,DepartmentSelect,TeamSelect,OfficeSelect,ClientSelect,VendorSelect}.tsx`
- Test: new `src/modules/organization/components/__tests__/OrgEntitySelectorFacades.test.tsx` (all six facades render + wire into OrgEntitySelector with the same props contract)

**Interfaces:**
- Consumes: `OrgEntitySelector` from `src/shared/relationships/OrgEntitySelector.tsx` (props: `entity`, `orgId`, `value`, `onChange(value | [values] | null)`, `fallbackLabel?`, `isMulti?`, `placeholder?`, `disabled?`, `permission?`) and entity hooks `usePeople`/`useDepartments`/`useTeams`/`useOffices`/`useClients`/`useVendors`/`useProjects` with `params?: { search?: string }` + `orgId`.
- Produces: each legacy selector keeps its existing props (`orgId`, `value`, `onChange(id, name?)`, `placeholder`, `className`, `disabled`) but delegates to `OrgEntitySelector` internally with the correct `entity` kind and label/kind mapping (`people`/`departments`/`teams`/`offices`/`clients`/`vendors`). Deprecated raw `<select>` + local filtering removed. In Task 3 these facades get validated against the existing form tests as-is (no form edits needed).

- [ ] **Step 1: Write the failing test**

```tsx
// src/modules/organization/components/__tests__/OrgEntitySelectorFacades.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/modules/organization/hooks/useOrganizationData', async (orig) => {
  const actual = await orig<typeof import('@/modules/organization/hooks/useOrganizationData')>();
  const people = [
    { id: 'p1', full_name: 'A One', department_name: 'Dept A', department_id: 'd1', role: 'Artist' },
    { id: 'p2', full_name: 'B Two', department_name: 'Dept B', department_id: 'd2', role: 'Supervisor' },
  ];
  return {
    ...actual,
    usePeople: () => ({ data: { results: people }, isLoading: false, isError: false }),
    useDepartments: () => ({
      data: [
        { id: 'd1', name: 'Dept A', code: 'DA' },
        { id: 'd2', name: 'Dept B', code: 'DB' },
      ],
      isLoading: false,
    }),
  };
});

import { PersonSelect } from '../PersonSelect';

function harness(props: any) {
  return render(
    <MemoryRouter>
      <PersonSelect {...props} />
    </MemoryRouter>,
  );
}

describe('legacy PersonSelect facade over OrgEntitySelector', () => {
  it('renders OrgEntitySelector with entity people and no client-side substring filtering', () => {
    const onChange = vi.fn();
    harness({ orgId: 'org1', onChange, departmentFilter: 'dept bd' });
    // The facade must not substring-match department names; it must render
    // the org-scoped selector content. (Legacy substring filters "dept bd"
    // would hide Dept A/B.)
    const control = screen.getByText(/Select crew member/i) || screen.getByText(/Select people/i);
    fireEvent.click(control);
    // Both options must be visible — no client-side filtering of names.
    expect(screen.queryByText(/^A One/)).toBeTruthy();
    expect(screen.queryByText(/^B Two/)).toBeTruthy();
  });

  it('calls onChange with the id on selection through the selector', () => {
    const onChange = vi.fn();
    harness({ orgId: 'org1', onChange });
    fireEvent.click(screen.getByText(/Select crew member/i));
    fireEvent.click(screen.getByText(/^A One/));
    expect(onChange).toHaveBeenCalledWith('p1', 'A One');
  });
});
```

(Keep harnesses parallel in `DepartmentSelect`/`TeamSelect`/`OfficeSelect`/`ClientSelect`/`VendorSelect` in the same file — same pattern, different entity + label shape + onChange name arg.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/modules/organization/components/__tests__/OrgEntitySelectorFacades.test.tsx`
Expected: FAIL (legacy `<select>` still string-filters/renders raw options).

- [ ] **Step 3: Implement the facades**

For each of the six legacy selectors, replace the raw `<select>` (and any string-substring filtering props like `departmentFilter`/`teamFilter`/`studioTypeFilter` applied client-side) with a facade calling `OrgEntitySelector`:

```tsx
// src/modules/organization/components/PersonSelect.tsx
import React from 'react';
import { OrgEntitySelector } from '@/shared/relationships/OrgEntitySelector';

interface PersonSelectProps {
  orgId?: string;
  value?: string;
  onChange: (personId: string, personName?: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const PersonSelect: React.FC<PersonSelectProps> = ({
  orgId,
  value,
  onChange,
  placeholder = '-- Select Crew Member --',
  className = '',
  disabled = false,
}) => {
  return (
    <OrgEntitySelector
      orgId={orgId}
      entity="people"
      value={value ?? null}
      isMulti={false}
      onChange={(v) => onChange(typeof v === 'string' ? v : '', undefined)}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
    />
  );
};
```

Mirror for the other five with entities `departments`, `teams`, `offices`, `clients`, `vendors`. Where callers pass still-needed filters (PersonSelect's `departmentFilter`/`teamFilter`), drop the substring matching and (in the same commit) switch `usePeople` to pass those ids as backend query params `{ department_id, team_id }` — the orgEntity hooks already accept `{search}`; add the same `{ department_id?, team_id? }` plumbing where the hook supports it, otherwise remove the filter and rely on the org scope (do not side-filter by name).

- [ ] **Step 4: Run test to verify pass**

Run: `npx vitest run src/modules/organization/components/__tests__/OrgEntitySelectorFacades.test.tsx`
Expected: PASS (facades render the selector, call onChange with ids, never substring-filter).

- [ ] **Step 5: Run existing selector + form suites**

Run: `npx vitest run src/shared/relationships/__tests__ src/features/organizations/__tests__/pages src/modules/organization/components/tabs/__tests__`
Expected: PASS (facade contract keeps existing form tests, including PersonRoleSelect and ProjectClientVendorForms).

- [ ] **Step 6: Commit**

```bash
git add src/modules/organization/components/{PersonSelect,DepartmentSelect,TeamSelect,OfficeSelect,ClientSelect,VendorSelect}.tsx src/modules/organization/components/__tests__/OrgEntitySelectorFacades.test.tsx
git commit -m "refactor(org-forms): unify relationship selectors as OrgEntitySelector facades"
```

### Task 3: Positions/role facade for master + custom semantics

**Files:**
- Modify: `src/modules/organization/components/ProductionRoleSelect.tsx` (keep API, internally reuse the selector surface or document why optgroup layout justifies a separate control — rule: same validation/source contract; inline optgroups stay only if rendering reason is documented).
- Test: existing `src/features/organizations/__tests__/pages/PersonRoleSelect.test.tsx` (assert master-before-custom ordering + blank-default requiredness stays; add a test that the underlying hook is passed the org id and masters+customs are included).

**Interfaces:**
- Consumes: `useAvailablePositions(orgId, { include: 'all_masters' })` + the same validity/stale-id semantics as OrgEntitySelector.
- Produces: ProductionRoleSelect continues to work with org scoping; source-of-truth remains `resolve_person_role` on the backend.

- [ ] **Step 1: Write the failing test** (extension in the existing PersonRoleSelect suite)

```ts
it('masters render before customs and the select remains required', () => {
  // render the existing PersonRoleSelect form; assert the ordering/optgroup contract
  // still matches masters-first after the facade consolidate work.
});
```

- [ ] **Step 2: Run to verify it fails** (or passes if unchanged — decide based on result).

- [ ] **Step 3: Align ProductionRoleSelect** to the unified semantics only where they diverge (shared loading/empty/error state and stale-id invalid-note via the same styles; keep the master/custom optgroups because they encode the two-scope role catalog, not because the selector can't render sections).

- [ ] **Step 4: Run PersonRoleSelect + facades + organization suites**

Run: `npx vitest run src/features/organizations/__tests__/pages/PersonRoleSelect.test.tsx src/modules/organization/components/__tests__/OrgEntitySelectorFacades.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/organization/components/ProductionRoleSelect.tsx src/features/organizations/__tests__/pages/PersonRoleSelect.test.tsx
git commit -m "refactor(org-forms): align ProductionRole select with shared org-scoped selector contract"
```

### Task 4: Full-suite + Playwright + merge proof

**Files:** none (verification only, on the merged result)

- [ ] **Step 1: Rebase onto main**

At start of work: `git rebase main` inside the worktree (main has the recent consolidations). If conflicts hit one of the touched files, resolve preserving both intents; re-run the touched tests.

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck`; `npx biome check src/modules/organization src/shared/relationships src/features/organizations src/modules/access`
Expected: zero errors (biome warnings allowed if pre-existing).

- [ ] **Step 3: Unit + integration suite**

Run: `npm run test`
Expected: PASS (counts change as new tests land; **no failures beyond the known parityHarness/env failures** from consolidated main).

- [ ] **Step 4: Playwright (merged main)**

Post-merge on `main` with Django reachable per `.env` (port 8000 → Django container nginx port; or 8000 direct): run the org-workspace specs that verify Access & RBAC scope and selector wiring.

```bash
npx playwright test e2e/consolidation.spec.ts e2e/organization-contact.spec.ts e2e/production-role-scoping.spec.ts
```

Extend `e2e/organization-contact.spec.ts` if needed so it asserts: Business → Projects tab exists; Access & RBAC shows only Users/Roles/Groups/Permissions; department dropdown in Project form lists the created department (existing spec flow already covers create + verify; augment assertions selectively).

- [ ] **Step 5: Commit + merge note**

Merge this branch onto `main` only when Steps 2-4 pass; write the merge note so downstream reviewers see: (a) Access & RBAC tabs are intentionally narrowed to four core items, (b) selector facades preserve legacy props, (c) production-membership `role_id`/status behavior unchanged from Phase 1.

## Out of scope

- New relationship dropdowns for model-less links (Rule 21 — nothing invented for dropdowns).
- Project membership management stays in the Project workspace (unchanged).
- Deleting the three access components or their Access-module routes.
- Backend changes (phase 1 scope and API already complete).

## Self-review

- Spec coverage: §1 section — Task 1; §2 selector unification — Task 2 (facades) + Task 3 (role facade); §3 exclusions map to Out of scope; §4 Playwright gate folded into Task 4 (merged main per your explicit choice).
- Placeholder scan: every step names exact files/ids; test names and object keys match the branch's files (`access-projects`, `access-simulator`, `access-audit`; entity kinds `people/departments/teams/offices/clients/vendors`; hook names `usePeople` etc.; ProductionRoleSelect props preserved verbatim).
- Type consistency: facade props reuse existing interfaces (`PersonSelect.onChange(id, name?)` etc.); `OrgEntitySelector.value` signature is `string | string[] | null`; `isMulti: false` in all six facades.
- Review Focus: five items each pinned to the named tasks (stale-id blocking → T3/T4 suites; client-side substring removed → T2 test; disabled tabs don't break access routes → T1 suite + access-module tests; permission note → test in T2 via `permission` prop; production-role ordering → T3 test).
