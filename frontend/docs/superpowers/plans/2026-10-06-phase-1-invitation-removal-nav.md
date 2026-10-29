# Phase 1 — Invitation Removal + Workspace Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Invitations from the Organization Workspace and restructure navigation to the target tree with optional-tab support.

**Architecture:** Extend the existing `WORKSPACE_SECTIONS` config in `OrganizationWorkspacePage.tsx` (add `enabled/required/order`), delete only the Invitation workspace surface, move Projects under Business, keep every other tab rendering untouched.

**Tech Stack:** React 19, react-router-dom v7 (`useSearchParams` `?tab=` routing), Zustand workspace persistence, `useAuth().can()` permission gating, vitest.

**Spec:** `docs/superpowers/specs/2026-10-06-organization-workspace-refactor-design.md` (§3.1, §3.2)

## Global Constraints

- Frontend talks to the Django REST API only — no mock API, MSW, or mock fallback in new code.
- Generated file `src/core/api/generated/**` is never hand-edited.
- Backend invitation API stays untouched (only the workspace surface is removed).
- Project/Production workspace remains functional — verify with its existing tests after nav changes.
- RBAC preserved: every tab keeps its `permission` gate; direct `?tab=` URLs stay auth-checked.

## Review Focus

- A persisted workspace state (localStorage) holding `tab=invitations` from before the removal must not resurrect the tab or crash — expect a safe redirect to `overview`.
- A user without `project.view` opening `?tab=projects` under its new Business section must still see Access Denied, not the tab.
- Removing `invitation.*` permission codes must not break role fixtures or tests that enumerate the catalog — expect those updated in the same phase.
- `OrgWorkspaceRedirect` aliases (`/people`, `/departments`, …) must keep resolving after the section move.
- The legacy `master-data → software` tab compat must keep working.

## File Map

- Modify: `src/modules/organization/pages/OrganizationWorkspacePage.tsx` (sections config, tab type, render switch)
- Delete: `src/modules/organization/components/tabs/InvitationsTab.tsx`
- Modify: `src/modules/organization/hooks/useWorkforceData.ts` (remove invitation hooks ~lines 213-380+, verify tail after line 320 before editing)
- Modify: `src/modules/organization/api/organizationApi.ts` (remove invitation methods lines 392-424, remove `CrewInvitation` import)
- Modify: `src/types/organization.ts` (remove `CrewInvitation` interface line 176 — only if no non-workspace usage remains; check first)
- Modify: `src/core/permissions/permissionCatalog.ts` (remove lines 571-576 invitation entries)
- Modify: `src/core/permissions/systemRoles.ts` (remove invitation grants lines 132-136, 259)
- Modify: `src/core/access/domainPermissions.ts` (review line 68 `people.invite` — workspace-scoped invite affordance; keep only if used outside invitations)
- Modify: `src/core/activity/activityService.ts` (review line 57 `'invitation'` union member)
- Modify tests: `src/features/organizations/__tests__/pages/PersonRoleSelect.test.tsx` (invitation mocks + InvitationsTab suite lines 49-505), `src/features/organizations/__tests__/entities/OrganizationEntitiesCrudAndActions.test.tsx:65`, `src/core/testing/suites/entityExhaustiveSuites.ts:79-101`
- Modify: `src/modules/organization/pages/__tests__/OrganizationWorkspaceAccessTabs.test.tsx` (update section expectations)
- Read-only reference: `src/core/workspace/useWorkspaceStore.ts`, `src/core/workspace/workspacePersistence.ts`, `src/routes/OrgWorkspaceRedirect.tsx`, `src/routes/AppRoutes.tsx`

---

### Task 1: Extend WorkspaceSectionDef with optional-tab fields

**Files:**
- Modify: `src/modules/organization/pages/OrganizationWorkspacePage.tsx:140-151`
- Test: `src/modules/organization/pages/__tests__/OrganizationWorkspaceAccessTabs.test.tsx`

**Interfaces:**
- Consumes: existing `WorkspaceSectionDef` (id/title/tabs with id/label/icon/description/permission).
- Produces: `WorkspaceSectionDef` with added optional `enabled?: boolean; required?: boolean; order?: number` on sections and optional `enabled?: boolean; required?: boolean; order?: number` on tabs; helper `isTabAvailable(tab)` used by Task 2.

- [ ] **Step 1: Write the failing test**

Add to `OrganizationWorkspaceAccessTabs.test.tsx`:

```tsx
import { WORKSPACE_SECTIONS } from '../OrganizationWorkspacePage';

test('disabled tabs are excluded from visible navigation', () => {
  const all = WORKSPACE_SECTIONS.flatMap((s) => s.tabs.map((t) => t.id));
  // After Task 2 this must not contain 'invitations'; optional-tab flags exist:
  expect(all).not.toContain('invitations');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/modules/organization/pages/__tests__/OrganizationWorkspaceAccessTabs.test.tsx`
Expected: FAIL (`invitations` still present).

- [ ] **Step 3: Extend the interface (types only, no behavior change yet)**

```tsx
export interface WorkspaceSectionDef {
  id: string;
  title: string;
  /** Set false to hide the whole section. Defaults true. */
  enabled?: boolean;
  /** True = cannot be disabled by configuration. */
  required?: boolean;
  order?: number;
  tabs: {
    id: OrgWorkspaceTabId;
    label: string;
    icon: React.FC<{ className?: string }>;
    description?: string;
    /** View permission required to see and open this tab. Absence hides it. */
    permission?: string;
    /** Set false to hide this tab. Defaults true. */
    enabled?: boolean;
    required?: boolean;
    order?: number;
  }[];
}
```

- [ ] **Step 4: Run tests to verify nothing breaks yet**

Run: `pnpm vitest run src/modules/organization/pages/__tests__/OrganizationWorkspaceAccessTabs.test.tsx`
Expected: FAIL still (invitations present) — that is resolved in Task 2. Typecheck passes: `pnpm typecheck`.

- [ ] **Step 5: Commit**

```bash
git add src/modules/organization/pages/OrganizationWorkspacePage.tsx src/modules/organization/pages/__tests__/OrganizationWorkspaceAccessTabs.test.tsx
git commit -m "feat(org-workspace): optional-tab fields on workspace section def"
```

---

### Task 2: Restructure sections — remove Invitations wiring, move Projects to Business

**Files:**
- Modify: `src/modules/organization/pages/OrganizationWorkspacePage.tsx` (lines 71, 93-138, 153-240, 514)

**Interfaces:**
- Consumes: extended `WorkspaceSectionDef` from Task 1.
- Produces: new `WORKSPACE_SECTIONS` tree: overview / workforce (people, departments, teams, positions) / business (clients, vendors, projects) / access (unchanged) / locations (unchanged) / master-data (unchanged) / config (unchanged) / security (unchanged) / activity (unchanged).

- [ ] **Step 1: Remove the InvitationsTab import (line 71)**

Delete line 71: `import { InvitationsTab } from '../components/tabs/InvitationsTab';`

- [ ] **Step 2: Remove `'invitations'` from OrgWorkspaceTabId (line 101)**

Delete line 101: `| 'invitations'`.

- [ ] **Step 3: Remove the invitations tab entry (line 167)**

Delete line 167: `{ id: 'invitations', label: 'Invitations', icon: Mail, permission: 'invitation.view' },`.

- [ ] **Step 4: Remove the invitations render branch (line 514)**

Delete line 514: `{activeTab === 'invitations' && <InvitationsTab org={org} />}`.

- [ ] **Step 5: Rename `directory` section to Business and keep Projects under it**

Replace:

```tsx
  {
    id: 'directory',
    title: 'Production Directory',
```

with:

```tsx
  {
    id: 'business',
    title: 'Business',
```

Projects tab stays `{ id: 'projects', label: 'Projects', icon: Film, permission: 'project.view' }` inside it.

- [ ] **Step 6: Remove now-unused `Mail` icon import if unused elsewhere in the file**

Run: `grep -n "Mail" src/modules/organization/pages/OrganizationWorkspacePage.tsx`
Expected: no matches remain. If a match remains, keep the import.

- [ ] **Step 7: Run the Task 1 test — it must pass now**

Run: `pnpm vitest run src/modules/organization/pages/__tests__/OrganizationWorkspaceAccessTabs.test.tsx`
Expected: PASS. Then `pnpm typecheck`.

- [ ] **Step 8: Commit**

```bash
git add src/modules/organization/pages/OrganizationWorkspacePage.tsx
git commit -m "feat(org-workspace): remove invitations tab, move projects under Business"
```

---

### Task 3: Enforce enabled/disabled + stale-tab redirect in the workspace page

**Files:**
- Modify: `src/modules/organization/pages/OrganizationWorkspacePage.tsx` (visibleSections ~line 260, activeTab resolution ~line 244-248, handleTabChange)
- Test: extend `src/modules/organization/pages/__tests__/OrganizationWorkspaceAccessTabs.test.tsx`

**Interfaces:**
- Consumes: `enabled` flags from Task 1, `useWorkspaceStore` persistence (read `src/core/workspace/workspacePersistence.ts` first to find the state key holding the last-open tab).
- Produces: `visibleSections` excludes `enabled === false` tabs/sections; unknown/disabled `?tab=` redirects to `overview` instead of rendering stale content.

- [ ] **Step 1: Read the persistence module to find stale-tab handling**

Read `src/core/workspace/workspacePersistence.ts` and `src/core/workspace/useWorkspaceStore.ts`. Note the exact key/shape storing the active org tab.

- [ ] **Step 2: Write the failing test**

```tsx
test('unknown or disabled tab resolves to overview', () => {
  const tabDef = WORKSPACE_SECTIONS.flatMap((s) => s.tabs).find((t) => (t.id as string) === 'invitations');
  expect(tabDef).toBeUndefined();
});
```

(This pins the redirect target: any resolver for a missing tab id must fall back to `overview`.)

- [ ] **Step 3: Filter disabled items in visibleSections**

```tsx
const visibleSections = useMemo(() => {
  return WORKSPACE_SECTIONS.filter((s) => s.enabled !== false)
    .map((section) => ({
      ...section,
      tabs: section.tabs.filter(
        (tab) => tab.enabled !== false && (!tab.permission || can(tab.permission)),
      ),
    }))
    .filter((section) => section.tabs.length > 0);
}, [can]);
```

- [ ] **Step 4: Redirect stale activeTab values to overview**

After the `rawTab`/`activeTab` lines, resolve against the real config:

```tsx
const knownTabIds = useMemo(
  () => new Set(WORKSPACE_SECTIONS.flatMap((s) => s.tabs.map((t) => t.id))),
  [],
);
const activeTab: OrgWorkspaceTabId = knownTabIds.has(rawTab) ? rawTab : 'overview';
```

Keep the legacy `master-data → software` compat mapping alongside it.

- [ ] **Step 5: Run tests + typecheck**

Run: `pnpm vitest run src/modules/organization/pages/__tests__/OrganizationWorkspaceAccessTabs.test.tsx && pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/organization/pages/OrganizationWorkspacePage.tsx src/modules/organization/pages/__tests__/OrganizationWorkspaceAccessTabs.test.tsx
git commit -m "feat(org-workspace): disabled-tab filtering and stale-tab redirect"
```

---

### Task 4: Delete InvitationsTab and invitation hooks/API surface

**Files:**
- Delete: `src/modules/organization/components/tabs/InvitationsTab.tsx`
- Modify: `src/modules/organization/hooks/useWorkforceData.ts` (remove invitation section; first read lines 320-end to capture the full block)
- Modify: `src/modules/organization/api/organizationApi.ts` (delete lines 392-424; remove `CrewInvitation` from imports)
- Modify: `src/types/organization.ts` (remove `CrewInvitation` interface at line 176 after confirming zero remaining imports)
- Modify: `src/core/permissions/permissionCatalog.ts` (delete lines 571-576)
- Modify: `src/core/permissions/systemRoles.ts` (remove invitation grants at lines 132-136 and 259 — read surrounding lines first)
- Modify: `src/core/activity/activityService.ts` (line 57 — remove `'invitation'` member only if nothing else emits it; verify with grep)
- Modify: `src/core/access/domainPermissions.ts` (line 68 — same verification)

- [ ] **Step 1: Verify the full invitation-hook block and all importers**

Run: `sed -n '320,460p' src/modules/organization/hooks/useWorkforceData.ts` and `grep -rn "useInvitations\|useInvitationMutations\|CrewInvitation\|createInvitation\|resendInvitation\|cancelInvitation\|deleteInvitation\|getInvitations" src --include='*.ts*' -l | grep -v generated`
Expected: importer list matches the File Map; no surprises (e.g. no route or command-palette usage).

- [ ] **Step 2: Delete the tab file and remove hooks + API methods + type + permission entries**

Delete `InvitationsTab.tsx`; remove the invitation block from `useWorkforceData.ts`, the five methods from `organizationApi.ts`, `CrewInvitation` (if unreferenced), the six catalog entries, and the system-role grants.

- [ ] **Step 3: Run typecheck — every stale importer is a compile error to fix**

Run: `pnpm typecheck`
Expected: errors only in the known test files (fixed in Task 5). Fix any source file errors immediately (remove the import/usage; never re-add invitation code).

- [ ] **Step 4: Commit**

```bash
git add -A && git status --short
git commit -m "feat(org-workspace): remove invitations surface (tab, hooks, api, permissions)"
```

Verify `git status` shows only intended files before committing.

---

### Task 5: Update tests + final stale-reference audit

**Files:**
- Modify: `src/features/organizations/__tests__/pages/PersonRoleSelect.test.tsx` (remove invitation mocks lines 49-86 and InvitationsTab suite lines 371-505; keep PeopleTab/ProductionRoleSelect coverage)
- Modify: `src/features/organizations/__tests__/entities/OrganizationEntitiesCrudAndActions.test.tsx` (line 65 area)
- Modify: `src/core/testing/suites/entityExhaustiveSuites.ts` (lines 79-101 invitation lifecycle)
- Test: full frontend suite + production build

- [ ] **Step 1: Rewrite the affected test sections without invitation coverage**

Remove invitation-specific describes/mocks. Where a test used `InvitationsTab` to exercise `ProductionRoleSelect` scoping, repoint it at `PeopleTab` (which also renders `ProductionRoleSelect`).

- [ ] **Step 2: Run the affected suites**

Run: `pnpm vitest run src/features/organizations src/modules/organization src/core/testing`
Expected: PASS.

- [ ] **Step 3: Repository-wide stale-reference search**

Run: `grep -rni "invitation" src e2e --include='*.ts*' -l | grep -v generated`
Expected: only backend-contract or historical mentions remain (e.g. OpenAPI schema, backend-driven types). Every `src/**` workspace hit (navigation, tab, hook, api client, permission, command) must be gone — remove it.

- [ ] **Step 4: Full suite + build**

Run: `pnpm vitest run && pnpm build`
Expected: PASS, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add -A && git status --short
git commit -m "test(org-workspace): drop invitation coverage, verify suite and build"
```

## Self-review

- Spec §3.1 covered by Tasks 1-3 (config, tree, disabled handling, redirect). Spec §3.2 covered by Tasks 4-5 (every audited file listed; generated schema excluded; backend untouched).
- No placeholders: every step names exact files/lines/commands.
- Type consistency: `enabled/required/order` naming matches the spec's optional-item concept (`id/label/section/route/icon/order/enabled/required/permission` — route/icon/permission already exist as tab fields).
- Phase 1 produces working software: workspace loads without Invitations, Projects under Business, suite green.
