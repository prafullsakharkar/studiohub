# Organization Workspace & Navigation Consolidation — Design Spec

Date: 2026-10-05
Status: Design approved (pending spec-file review)
Scope: `studiohub-react` frontend only
Approach: audit-driven removal — no new navigation/workspace systems, reuse existing Organization Workspace as the single source of truth

## 1. Outcome

One source of truth for organization functionality: **Organization Workspace**.
Left navigation becomes global-only. Organization-scoped list functionality
(People/Departments/Teams/Offices/Clients/Vendors/Access-including-RBAC)
lives exclusively under `Organization → Workspace → Tab`. Entity detail and
form routes (`/people/:id`, `/people/new`, `/factions…` equivalents) remain the
deep-link targets of workspace tabs.

## 2. Duplication matrix (verified in source)

Code evidence: `src/layouts/Sidebar.tsx:97-171` (ORGANIZATION section) +
`src/routes/AppRoutes.tsx` + standalone pages under
`src/modules/organization/pages/` + workspace sections in
`src/modules/organization/pages/OrganizationWorkspacePage.tsx:127-203`.

| Feature | Sidebar | Workspace tab | Verdict |
|---|---|---|---|
| Organizations | `/organizations` (global org chooser) | Workspace entry | Sidebar stays — global scope |
| Access & RBAC | `/organizations/:id/access` nav item | Access section tabs (roles/permissions/groups) | Workspace canonical; sidebar entry removed |
| People | `/people` + `PeoplePage.tsx` | `PeopleTab` | Workspace canonical; list page removed |
| Departments | `/departments` + `DepartmentsPage.tsx` | `DepartmentsTab` | Workspace canonical; list page removed |
| Teams | `/teams` + `TeamsPage.tsx` | `TeamsTab` | Workspace canonical; list page removed |
| Offices | `/offices` + `OfficesPage.tsx` | `OfficesTab` | Workspace canonical; list page removed |
| Clients | `/clients` + `ClientsPage.tsx` | `ClientsTab` | Workspace canonical; list page removed |
| Vendors | `/vendors` + `VendorsPage.tsx` | `VendorsTab` | Workspace canonical; list page removed |
| Projects | `/projects` + `ProjectsPage.tsx` | `ProjectsTab` + project workspace (`/projects/:id`) | `/projects` list page is the catalog-level entry — keep route, remove as org-management duplicate is resolved by making workspace Projects tab deep-link to /projects |
| Dashboard, Production surfaces (shots/assets/tasks/timelogs/versions/publishing/deliveries/reviews/workflows/scheduling), Platform (admin/health/data-platform/notifications/reports/billing/testing), Audit (audit/system-logs/jobs) | Yes | No | Keep — global scope (no duplication) |

## 3. Removal list (actual code to delete)

Navigation (`src/layouts/Sidebar.tsx`):
- ORGANIZATION section keeps only `Organizations` (global list) +
  rev badge handling for `currentOrganization.code` — drop `Access & RBAC /
  Clients / Vendors / People / Departments / Teams / Offices` entries and
  their permissions wiring.

Routes (`src/routes/AppRoutes.tsx`) — remove and redirect (both paths come
from the workspace, never render dead pages):
- `/people` → `/organizations/:orgId?tab=people`
- `/departments` → `/organizations/:orgId?tab=departments`
- `/teams` → `/organizations/:orgId?tab=teams`
- `/offices` → `/organizations/:orgId?tab=offices`
- `/clients` → `/organizations/:orgId?tab=clients`
- `/vendors` → `/organizations/:orgId?tab=vendors`
- `/access` (and `/access/:section`) → `/organizations/:orgId?tab=roles`
  (mapping: overview→roles, users→roles, groups→groups, permissions→permissions,
  projects→projects, simulator→roles, audit→activity — spec to lock during plan)
- `/organizations/:orgId/access` (+ `:section`) → `/organizations/:orgId?tab=…`
  via `PreserveQueryRedirect` pattern.

Keep (not mandatory duplicate): `/people/:id`, `/people/new`, `/people/:id/edit`
(…and the same for departments/teams/offices/clients/vendors) — deep-link
targets; tabs navigate to them.

Pages to delete after verification (no other consumers):
- `src/modules/organization/pages/{PeoplePage,DepartmentsPage,TeamsPage,OfficesPage,ClientsPage,VendorsPage}.tsx`
- `src/modules/access/pages/AccessWorkspacePage.tsx` after its sections are adopted

## 4. Access & RBAC full consolidation (user-approved)

`AccessWorkspacePage.tsxx` (via `src/modules/access/pages/`) has 8 sections:
overview, users, roles, groups, permissions, projects, simulator, audit —
richer than the workspace's 3 tabs. Consolidation plan:

- Keep the ACCESS module as the canonical implementation (components under
  `src/modules/access/components/`: `AccessOverviewSection`,
  `UserAccessSection`, `RolesWorkspaceSection`, `GroupsManagementSection`,
  `PermissionsCatalogSection`, `ProjectAccessSection`,
  `PermissionSimulatorSection`, `AccessAuditSection`).
- Expand workspace Access & RBAC section: replace the lightweight tabs
  (`RolesTab`, `GroupsTab`, `PermissionsTab` under
  `src/modules/organization/components/tabs/`) with the access module's
  components tab-for-tab; add the 5 additional tabs
  (overview/users/projects/simulator/audit).
- Delete the now-redundant lightweight tabs after the richer sections are
  verified equivalent or superior.
- Delete `AccessWorkspacePage.tsx` + its `/access` routes; redirects map
  old paths to workspace tabs (above).
- Update the workspace's own "Access Workspace" header action
  (`OrganizationWorkspacePage.tsx`) to redirect to `?tab=roles` instead of
  `/access/:section`.

## 5. Guardrails / do-not-break

- No new nav/workspace systems introduced; only deletions + reused
  components.
- Permissions: every workspace tab keeps its permission gate; sidebar
  authorization remains permission-based (`evaluateUserPermission`,
  `isUserAdmin` for QA Runner, superuser break-glass) — no bypass
  re-enabled.
- Deep links: `PreserveQueryRedirect`-style redirect components keep old URLs
  resolving to workspace tabs (no 404 regression).
- Tests: update or remove page tests for deleted pages; add workspace
  coverage for the newly-adopted access sections; e2e navigation assertions
  in `e2e/org-access.spec.ts` + `e2e/organization-isolation.spec.ts`
  must keep assertions when navigating after sidebar changes.
- No backend changes.
- `pnpm vitest run`, `pnpm exec tsc --noEmit`, `pnpm build`, and
  `pnpm exec playwright test e2e/org-access.spec.ts e2e/organization-isolation.spec.ts`
  must all pass.

## 6. Migration note

`OrganizationNavigationAudit` document:
`docs/frontend/ORGANIZATION_NAVIGATION_AUDIT.md` contains the before/after
inventory and the migration matrix. The consolidation above satisfies its
Definition-of-Done items.

## 7. Open items for implementation planning

- Exact `/access → ?tab=` mapping per Access section ID (planner locks it;
  defaults above are placeholders).
- Whether AccessOverviewSection absorbs the workspace Overview tab or stays
  separate inside Access & RBAC — resolution: separate; workspace Overview
  keeps its identity, Access section adds its own Overview tab.
- Sidebar ORGANIZATION section header display rules after removal of 7
  entries (does the section still render with Organizations + badge only).
