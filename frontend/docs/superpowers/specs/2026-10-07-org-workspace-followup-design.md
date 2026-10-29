# Design: Organization Workspace Follow-up — Access & RBAC Scope + Selector Unification

Date: 2026-10-07
Status: Approved deltas (Access & RBAC tighten, selector unification)
Base branch: `feat/org-workspace-refactor` (rebase target: `main` @ `de0f294`)
Predecessor spec: `2026-10-07-backend-frontend-consolidation-design.md` (merged phases 1+2)

## 1. Intent

Finish the Organization Workspace refactor on the existing
`feat/org-workspace-refactor` branch, which already lands — proven by its
commits — invitations removal, sectioned `WORKSPACE_SECTIONS` config,
optional `enabled`/`required` tabs with stale-tab redirect, the org-scoped
`OrgEntitySelector`, entity definitions, and relationship-driven people /
departments / teams / positions / clients / vendors / projects / groups
forms. This change closes the two remaining gaps you chose:
**tighten Access & RBAC** and **unify the legacy relationship selectors**.

Two hard rules stay active: Django REST is the only data source (no mock /
MSW / SQLite fallback); frontend gating is UX only — backend stays
authoritative; organization isolation is never weakened.

## 2. Section 1 — Access & RBAC scope

Current section (workspace page, branch HEAD):
`roles, permissions, groups, users, access-projects, access-simulator,
access-audit` — plus the paired tab bodies at
`OrganizationWorkspacePage.tsx:541-543`
(`ProjectAccessSection`, `PermissionSimulatorSection`, `AccessAuditSection`).

Target scope per your section 4:
`Users, Roles, Groups, Permissions` — Projects lives under Business
(`business.projects`, already there), and the plan's non-CRUD Activity &
Audit and Security sections stay separate (already separate at
`security.api-keys / security.pats / activity.activity`-audit).

Design:
- Workspace tab ids `access-projects`, `access-simulator`, `access-audit`
  become `enabled: false` on the branch's `WORKSPACE_SECTIONS`, with the
  existing machinery doing the work: hidden from navigation, dropped from
  tab filtering, and `unknown ✕ ?tab=` → falls back to `overview` (already
  implemented on the branch). Tab bodies stay compiled (not removed) so the
  underlying sections keep working from their canonical routes
  (`/organizations/:org/access/*`), exactly like today's `GroupsSection` →
  `GroupsManagementSection` link: platform keeps a read-only catalog and
  links to Access → Groups rather than duplicating management.
- The underlying `ProjectAccessSection`, `PermissionSimulatorSection`, and
  `AccessAuditSection` components are NOT deleted — they back the
  `/organizations/:org/access/*` routes which remain the canonical Access
  workspace; only the redundant inline tabs are disabled in the org
  workspace. (This is the "keep but disable" path, which the plan
  explicitly authorizes via `enabled: false`.)

## 3. Section 2 — Unify relationship selectors

Current state (branch confirms): `OrgEntitySelector` is the canonical
DRF-backed org-scoped selector (`async search, stale-id tracking, org
reset, permission gate`) used by people/department/team/position/
client/vendor/project/group forms. But the legacy per-entity wrappers
(`PersonSelect`, `DepartmentSelect`, `TeamSelect`, `OfficeSelect`,
`ClientSelect`, `VendorSelect`) remain as thin native `<select>`s with
client-side filtering (PersonSelect) or no search (`DepartmentSelect`
style), and `ProductionRoleSelect` stays a separate master+custom type
picker backed by the positions API.

Design — incremental, not a rewrite:
- **Keep** `OrgEntitySelector` as the single rendering + querying component.
  New parameter `roleDefaults?: { masterBeforeCustom?: boolean }` (or a
  `kind: 'role'` extension with position-scope qualification) so Production
  Role selects stay on the same surface without inventing a second
  framework. The positions API already serves global-master + own-org
  custom scopes via `useAvailablePositions` (see `ProductionRoleSelect.tsx`).
- **Replace** the six legacy `<select>` wrappers with thin facades over
  `OrgEntitySelector` that preserve their existing props
  (`onChange(id, name?)`, `placeholder`, `disabled`, filter props where
  the caller genuinely needs them). Facades pass the same `orgId`,
  `entity` kind, and `fallbackLabel` plumbing the forms already use, so
  existing form tests (`PersonRoleSelect.test.tsx`, `TeamDepartmentOfficeForms
  .test.tsx`, `ProjectClientVendorForms.test.tsx`) keep passing with no churn
  in assertions.
- **Retire client-side filtering for org-scope.** PersonSelect's
  `departmentFilter`/`teamFilter` text/name matching (substring on
  `department_name`/`team_name`) is replaced by backend query params
  (`usePeople({ department_id }, orgId)` style) or removed where the caller
  doesn't actually need it — never `filter by string` on related entity
  names.
- Keep `ProductionRoleSelect`'s positional semantics (required dropdown,
  blank default, stale-id clearing) but move its rendering to the unified
  facade so there's one picker style; the underlying `useAvailablePositions`
  hook and scope logic stay.

## 4. Section 3 — What stays out of scope (and why)

- New entity-relationship dropdowns where the Django model has none
  (per your section 21 rule: no invented dropdowns). Master-data forms
  keep scalar inputs unless the model actually links to a Lifecycle Status
  or similar.
- Cascading between non-org parents (e.g. Department → Team child
  reshuffles inside Team form) — the only required cascade is org change,
  which `OrgEntitySelector` already implements.
- Backend: already complete for this task (Phase 1 consolidated schema,
  fail-closed relationship validation, member permissions). No new backend
  changes here beyond what Phase 1 landed.
- Activity/Audit and Security remain separate sections (already separate).
- Multi-org Person switching is existing behavior (`switchOrganization` +
  org header) — unaffected.

## 5. Data flow

`OrganizationContext` supplies the active org; workspace tab filtering is
org-aware via `useAuth().can(, orgId)`; forms pass `orgId` into the unified
selector, which queries the DRF hooks with debounced server-side search and
blocks submit on stale ids. Cross-org picks stay impossible in UI (scoped
query) and are rejected by backend serializers if replayed over the wire.

## 6. Testing

- Unit: existing selector/form suites must stay green, plus focused tests
  for the new facade behavior (legacy props → OrgEntitySelector, validity
  wiring, org-change reset).
- Org-workspace suite (`OrganizationWorkspaceAccessTabs.test.tsx`)
  extended so disabled tabs hide from navigation and direct `?tab=...`
  URLs fall back to overview.
- Playwright on `main` (merged result) after merge: login → org A →
  People/Departments/Teams/Offices/Clients/Vendors/Projects tabs render;
  Access & RBAC shows Users/Roles/Groups/Permissions only (no Projects/
  Simulator/Audit tabs); Business → Projects present; org B isolation
  verified; relationship-driven form specs remain the canonical
  `PersonRoleSelect` / `*Forms` / selector suites.

## 7. Non-goals

- Redesigning workspace/Persistence internals; section ids already match.
- Deleting the three Access tab components or their canonical routes.
- Changing identities (User vs Person) or any RBAC permissions assignments
  (existing permission codes stay; only their placement in the org
  workspace moves).

## 8. Self-review

- No placeholders; each task names the exact file/facade or tab ids.
- Internal consistency: disabling tabs only removes org-workspace rendering,
  not their canonical access-section routes — matching the branch's own
  `enabled` semantics and the earlier N3 (one canonical Groups manager)
  decision.
- Scope: deltas only (Access & RBAC section, selector unification,
  Playwright proof) — everything else on the branch stays untouched.
- Ambiguity resolved: "simulator"/"audit" access tabs are disabled via
  `enabled: false`, components and routes survive; legacy selectors become
  facades, not re-implementations.
