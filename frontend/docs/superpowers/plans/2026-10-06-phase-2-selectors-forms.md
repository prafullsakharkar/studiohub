# Phase 2 — Relationship Selectors + Relationship-Driven Forms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every form field that represents an existing organization entity uses an org-scoped, DRF-backed dropdown/multi-select with cascading and inline-create.

**Architecture:** Build one DRF-backed `OrgEntitySelector` in `shared/relationships/` on the existing query hooks (`useDepartments`, `useTeams`, `usePeople`, `useOffices`, `useClients`, `useVendors`, `useProjects`, `useAvailablePositions` — all `(params?, orgId?)` shaped); thread explicit `orgId` through the existing `*Select.tsx` components; swap each audited free-text violation; add small per-entity definition modules (no god file).

**Tech Stack:** React 19, TanStack Query hooks, nested DRF routes `/api/organizations/{org}/...`, vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-06-organization-workspace-refactor-design.md` (§3.3, §3.4)

## Global Constraints

- All selector options come from Django REST (nested org routes); never fetch-all-then-filter in React (ADR-0033 D5 precedent).
- Only implement relationships that exist in the Django data model — no invented relations; scalar fields stay scalar.
- `ProductionRoleSelect` (scoped Global-Master + own-org custom) is the role pattern — reuse, don't duplicate.
- No second workspace framework; no giant config file — one definition module per entity.
- Requires Phase 1 complete (Invitations gone, Business section exists).

## Review Focus

- A selector opened for Org A then reused after switching to Org B must never show Org A options — expect options reset on `orgId` change.
- A record whose related entity was deleted/archived must still render (stale-id note, submit blocked) — expect the `ProductionRoleSelect` stale pattern.
- Typing in a selector with 1000+ departments must hit the server with `{search}` params — expect no full-list fetch.
- A user without `department.view` must see a no-permission state, not an empty list or a crash.
- Inline-created related entity must auto-select in the parent form without losing other entered values.

## File Map

- Create: `src/shared/relationships/OrgEntitySelector.tsx` (+ test beside it)
- Modify: `src/modules/organization/components/DepartmentSelect.tsx`, `TeamSelect.tsx`, `OfficeSelect.tsx`, `PersonSelect.tsx`, `ClientSelect.tsx`, `VendorSelect.tsx` (add `orgId` prop; verify each file's current props first — same shape as DepartmentSelect)
- Modify forms: `PeopleTab.tsx:314` (+ hardcoded office `:92,226`), `PositionsTab.tsx:487`, `TeamsTab.tsx:193,206,217`, `DepartmentsTab.tsx:207`, `OfficesTab.tsx:237`
- Create definitions: `src/modules/organization/definitions/<entity>Definition.ts` per entity (person, department, team, position, client, vendor, project, office, role, group) + `src/modules/organization/definitions/index.ts`
- Reference (read before editing): hook signatures in `useOrgStructureData.ts`, `usePeopleData.ts`, `useClientData.ts`, `useVendorData.ts`, `useWorkforceData.ts`; `organizationApi` method names; `src/types/organization.ts` entity shapes

---

### Task 1: Build the DRF-backed OrgEntitySelector

**Files:**
- Create: `src/shared/relationships/OrgEntitySelector.tsx`
- Create: `src/shared/relationships/__tests__/OrgEntitySelector.test.tsx`

**Interfaces:**
- Consumes: per-entity query hooks `(params?: {search?: string}, orgId?: string)` returning `{data, isLoading, isError}`.
- Produces: `OrgEntitySelector({orgId, entity: 'departments'|'teams'|'people'|'offices'|'clients'|'vendors'|'projects', value, isMulti, onChange, placeholder, disabled, permission})` — server search via `{search}` param, loading/empty/error/no-permission states, clear-selection, stale-value display. NOTE: existing `AsyncEntitySelector` is local-registry based (`searchAllEntities`) — do NOT reuse it for org data; this component replaces that pattern for org entities.

- [ ] **Step 1: Write the failing test (mock the hook, not the API)**

```tsx
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { OrgEntitySelector } from '../OrgEntitySelector';

vi.mock('@/modules/organization/hooks/useOrganizationData', () => ({
  useDepartments: (params: any, orgId?: string) => ({
    data: orgId === 'org-a' ? [{ id: 'd1', name: 'FX', code: 'FX' }] : [],
    isLoading: false, isError: false,
  }),
}));

test('loads options scoped to the given org', () => {
  render(<OrgEntitySelector orgId="org-a" entity="departments" value="" onChange={() => {}} />);
  expect(screen.getByText(/FX/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/shared/relationships/__tests__/OrgEntitySelector.test.tsx`
Expected: FAIL (`OrgEntitySelector` does not exist).

- [ ] **Step 3: Implement the selector (single-select + multi + states)**

Model styling on `AsyncEntitySelector.tsx` (control box, dropdown, chips, clear button) but drive options from the mapped hook with debounced `{search}` param:

```tsx
const HOOKS = { departments: useDepartments, teams: useTeams, people: usePeople, offices: useOffices, clients: useClients, vendors: useVendors, projects: useProjects };
```

Requirements: reset selection display when `orgId` changes (mirror `ProductionRoleSelect`'s `prevOrgId` reset effect); `permission` prop gates with `useAuth().can()` showing a no-permission note; error state with retry; empty state text; `onChange` returns id (single) or ids (multi); stale `value` id absent from results renders the stored label with an amber "no longer available" note and blocks submit (parent checks validity).

- [ ] **Step 4: Run test to verify it passes + typecheck**

Run: `pnpm vitest run src/shared/relationships/__tests__/OrgEntitySelector.test.tsx && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/relationships/OrgEntitySelector.tsx src/shared/relationships/__tests__/OrgEntitySelector.test.tsx
git commit -m "feat(selectors): DRF-backed org-scoped entity selector"
```

---

### Task 2: Thread explicit orgId through existing *Select components

**Files:**
- Modify: `DepartmentSelect.tsx`, `TeamSelect.tsx`, `OfficeSelect.tsx`, `PersonSelect.tsx`, `ClientSelect.tsx`, `VendorSelect.tsx` (read each first — same 43-line shape as DepartmentSelect)

**Interfaces:**
- Consumes: `OrgEntitySelector` (Task 1) or the component's current hook call.
- Produces: each Select accepts `orgId?: string` and passes it to its hook (`useDepartments(params, orgId)`), so workspace tabs render options for the viewed org, not just `currentOrganization`.

- [ ] **Step 1: Read the remaining Select components and note their hook calls**

Run: `cat src/modules/organization/components/TeamSelect.tsx src/modules/organization/components/OfficeSelect.tsx src/modules/organization/components/PersonSelect.tsx src/modules/organization/components/ClientSelect.tsx src/modules/organization/components/VendorSelect.tsx`
Expected: each calls its hook without `orgId` (like `DepartmentSelect.tsx:19`).

- [ ] **Step 2: Add orgId prop + pass-through in each component**

```tsx
interface DepartmentSelectProps {
  orgId?: string;
  value?: string;
  onChange: (deptId: string, deptName?: string) => void;
  // ...
}
const { data: departments, isLoading } = useDepartments(undefined, orgId);
```

Apply the identical change per component with its own hook/params.

- [ ] **Step 3: Verify callers still compile (orgId optional, backward compatible)**

Run: `pnpm typecheck`
Expected: PASS (prop is optional; existing callers unchanged).

- [ ] **Step 4: Commit**

```bash
git add src/modules/organization/components/*Select.tsx
git commit -m "feat(selectors): explicit orgId scoping for entity selects"
```

---

### Task 3: People + Positions relationship fields

**Files:**
- Modify: `src/modules/organization/components/tabs/PeopleTab.tsx`
- Modify: `src/modules/organization/components/tabs/PositionsTab.tsx`
- Test: extend `src/features/organizations/__tests__/pages/PersonRoleSelect.test.tsx`

**Interfaces:**
- Consumes: `DepartmentSelect`/`OfficeSelect` (Task 2, with `orgId={org.id}`), `ProductionRoleSelect` (existing), `TeamSelect` multi (add `isMulti` if missing — check file first).
- Produces: People form with department dropdown, team multi-select, office dropdown, scoped role dropdown, zero free-text entity fields; Positions form with department dropdown from `useDepartments`.

- [ ] **Step 1: Replace PeopleTab free-text department (line 314) with DepartmentSelect**

Replace the `<input value={newDept}>` block with:

```tsx
<DepartmentSelect orgId={org.id} value={newDeptId} onChange={(id) => setNewDeptId(id)} />
```

Rename state `newDept` (string name) → `newDeptId` (id); submit payload sends `department_id` (keep `department_name` only if the DRF serializer requires it — check `backend/apps/organization/api/serializers/person/create.py` or the OpenAPI schema; prefer id-only).

- [ ] **Step 2: Replace hardcoded office (`office_name: org.headquarters`, lines 92/226) with OfficeSelect**

Add `newOfficeId` state + `<OfficeSelect orgId={org.id} .../>`; submit `office_id`.

- [ ] **Step 3: Add Team multi-select to the People form**

Add `TeamSelect` multi-value wiring (`newTeamIds: string[]`); submit team ids per the person serializer's accepted shape (verify against schema first).

- [ ] **Step 4: Replace PositionsTab hardcoded department select (line 487) with scoped options**

Replace the 7 hardcoded `<option>` strings with `useDepartments(undefined, org.id)` data (the `InvitationsTab:415` pattern — now deleted, so copy the pattern: select over fetched departments with loading placeholder).

- [ ] **Step 5: Extend tests — selectors load from DRF, scoped to org**

Add cases: department dropdown lists the mocked org departments; submitting sends ids; a department from another org is unavailable. Run: `pnpm vitest run src/features/organizations/__tests__/pages/PersonRoleSelect.test.tsx`. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/organization/components/tabs/PeopleTab.tsx src/modules/organization/components/tabs/PositionsTab.tsx src/features/organizations/__tests__/pages/PersonRoleSelect.test.tsx
git commit -m "feat(org-forms): relationship-driven people and positions forms"
```

---

### Task 4: Teams + Departments + Offices relationship fields

**Files:**
- Modify: `TeamsTab.tsx` (lines 193/206/217), `DepartmentsTab.tsx` (207), `OfficesTab.tsx` (237)
- Test: colocated or feature tests per tab (follow existing test layout)

**Interfaces:**
- Consumes: Task 2 selects + Task 1 `OrgEntitySelector` for projects.
- Produces: Team form (department dropdown, lead→Person selector, projects multi-select); Department form (manager→Person selector); Office form (manager→Person selector).

- [ ] **Step 1: Read the three tab forms fully before editing**

Read `TeamsTab.tsx`, `DepartmentsTab.tsx`, `OfficesTab.tsx`. Record each modal's state names and submit payload shape.

- [ ] **Step 2: Swap each free-text entity field for its selector (org-scoped)**

Teams: `leadName` input → Person selector; `departmentName` input → `DepartmentSelect orgId`; `currentProjectCode` input → `OrgEntitySelector entity="projects"`. Departments: `headName` → Person selector. Offices: `managerName` → Person selector. Payloads send `*_id` values; verify each key against the corresponding DRF serializer (id vs nested object) before wiring.

- [ ] **Step 3: Add cascading — department change clears invalid team/project picks**

When the department selection changes, drop team/project ids not belonging to it and reload options (parent-change effect, same reset pattern as `ProductionRoleSelect`'s org-change reset).

- [ ] **Step 4: Test each form's selectors (scoped load, id persistence, stale handling)**

Run: `pnpm vitest run src/features/organizations src/modules/organization`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/organization/components/tabs/TeamsTab.tsx src/modules/organization/components/tabs/DepartmentsTab.tsx src/modules/organization/components/tabs/OfficesTab.tsx
git commit -m "feat(org-forms): relationship-driven team, department and office forms"
```

---

### Task 5: Project + Client/Vendor + Group/Role forms and per-entity definitions

**Files:**
- Modify: `ProjectsTab.tsx`, `ClientsTab.tsx`, `VendorsTab.tsx` (currently read-only lists — add create/edit modals only if the DRF endpoints + serializers support them; verify `organizationApi` client/vendor/project methods first)
- Modify: access sections `RolesWorkspaceSection.tsx`, `GroupsManagementSection.tsx`, `UserAccessSection.tsx` (add scoped user/role multi-selects where the membership/role serializers accept them)
- Create: `src/modules/organization/definitions/{person,department,team,position,client,vendor,project,office,role,group}Definition.ts` + `index.ts`
- Master data: add lifecycle-status dropdowns in `OrgTaskTypeConfig`/`OrgCatalogConfig`/etc. only where the config serializer has that FK (check `backend/apps/masterdata/api/serializers/` first; skip silently where scalar)

**Interfaces:**
- Each `XDefinition.ts` exports: `{ entity, fields, columns, filters, searchKeys, sorting, relationships: [{field, entity, multi, cascadeFrom?}], capabilities: ('VIEW'|'CREATE'|'UPDATE'|'ARCHIVE'|'RESTORE'|'DELETE'|...)[] , permissions: {view, create, update, ...}, routes: {list, detail} }`. Small files, one entity each.

- [ ] **Step 1: Verify serializer shapes for project/client/vendor/group writes**

Check the OpenAPI schema + `organizationApi` for accepted relationship keys (`client_id` vs `client`, `vendor_ids`, etc.). Record the exact keys — the forms must send those and nothing else.

- [ ] **Step 2: Implement Project form (client dropdown, vendors/departments/teams/people multi-selects, office dropdown)**

All selectors with `orgId={org.id}`; server-side `{search}`; cascading (client change does not clear teams — only true parent/child pairs cascade: org→department→team).

- [ ] **Step 3: Implement Client/Vendor project multi-selects + Group users/roles multi-selects + Role scoped catalog**

Groups: users multi-select (org members) + roles multi-select (own-org + masters). Roles: `ProductionRoleSelect`-equivalent scoped catalog (reuse the component if it fits, else extract its hook pattern).

- [ ] **Step 4: Write one definition module per entity + barrel index**

Keep each under ~80 lines: fields/columns/filters/relationships/capabilities/permissions/routes. Tabs import their definition for columns/actions instead of inline constants (migrate incrementally — definition first, tab adoption where trivial).

- [ ] **Step 5: Full frontend suite + typecheck**

Run: `pnpm vitest run && pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git status --short
git commit -m "feat(org-forms): project, client, vendor, group relationship forms and entity definitions"
```

## Self-review

- Spec §3.3 covered by Tasks 1-2 (canonical selector, orgId threading, inline-create states). Spec §3.4 covered by Tasks 3-5 (every audited violation mapped to a step; master-data constrained to real FKs; cascading in Tasks 3-5).
- No placeholders: steps name exact files/lines/components; unknown serializer keys get explicit verify-first steps.
- Type consistency: `orgId?: string`, `entity` union, `value: string | string[]`, `onChange(ids)` carried across Tasks 1-5.
- Phase 2 produces working software: all workspace forms relationship-driven, suite green.
