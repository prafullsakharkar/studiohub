# Organization Workspace Refactor — Design Spec (2026-10-06)

## 1. Intent (agreed)
Refactor the Organization Workspace into a clean, enterprise-grade,
configuration-driven workspace with reusable CRUD architecture and
organization-safe relationship management, using the existing Django REST
API only. No mock API / MSW / SQLite fallback. Project/Production
workspace stays unaffected; RBAC and workspace architecture preserved.

## 2. Audit findings (evidence)
Frontend (`studiohub-react`):
- Owner: `src/modules/organization/pages/OrganizationWorkspacePage.tsx`
  (`WORKSPACE_SECTIONS:153`, `OrgWorkspaceTabId`, `?tab=` routing,
  permission-filtered `visibleSections:260`).
- Routes: `/organizations/:id` + `OrgWorkspaceRedirect` aliases
  (`AppRoutes.tsx:136,162-252`).
- Invitation surface (frontend-only removal): `components/tabs/InvitationsTab.tsx`
  (wired at `OrganizationWorkspacePage.tsx:71,101,167,514`),
  `useInvitations`/`useInvitationMutations` (`hooks/useWorkforceData.ts:219,239`),
  `organizationApi` invitation methods (`:393-423`), `CrewInvitation`
  (`types/organization.ts:176`), `invitation.*` permission codes
  (`permissionCatalog.ts:571-576`, `systemRoles.ts:132-136,259`,
  `domainPermissions.ts:68`), workspace tests
  (`PersonRoleSelect.test.tsx`, `OrganizationEntitiesCrudAndActions.test.tsx:65`,
  `entityExhaustiveSuites.ts:79-101`), activity type (`activityService.ts:57`).
  No `/invite/:token` route, no command-palette invitation command.
  Generated OpenAPI schema is generated output — untouched.
- Reusable infra (reuse, don't rebuild): `shared/workspace/*`,
  `shared/workspace/canonical/*`, `AsyncEntitySelector` +
  `RelationshipSelector` + `EntityPicker` (`shared/relationships/`),
  org selectors (`Department/Team/Office/Person/Client/Vendor/ClientContactSelect`,
  `ProductionRoleSelect` = scoped Global-Master + own-org custom catalog),
  `useWorkspaceStore` + `workspacePersistence`, `useAuth()/can()`,
  `currentOrganization` context.
- Free-text violations to fix: `PeopleTab.tsx:314` dept input (+ hardcoded
  `office_name:92`); `PositionsTab.tsx:487` hardcoded dept select;
  `TeamsTab.tsx:193,206,217` lead/department/project inputs;
  `DepartmentsTab.tsx:207` headName; `OfficesTab.tsx:237` managerName.
  Clients/Vendors/Projects tabs are read-only lists (no create forms yet).

Backend (`../studiohub`, separate commits):
- Nested routes preferred: `/api/organizations/<org>/<resource>/`
  (`organization/api/urls_nested.py`); flat `/api/v1/` + canonical
  `/api/v1/organization/` also exist.
- `validate()` org-guards EXIST for person/team/department/office/role;
  MISSING for invitation, membership, groups, clients, vendors, masterdata,
  calendars. Invitation uses status lifecycle (no archive/restore).
  Universal archive/restore via `BulkArchiveRestoreMixin`.
  Invitation backend stays untouched (only workspace surface removed).

## 3. Design
### 3.1 Workspace navigation
Restructure `WORKSPACE_SECTIONS` to: Overview / People&Workforce
(People, Departments, Teams, Positions — no Invitations) / Business
(Clients, Vendors, Projects) / Access&RBAC (Users, Roles, Groups,
Permissions + project-access/simulator/audit) / Locations&Calendar
(Offices, Work Calendars, Work Hours, Calendars, Holidays) /
Production Master Data / Configuration / Security (API Keys, PATs) /
Activity&Audit. Resolve the Projects ambiguity: workspace Projects =
business entity; project-access membership UI stays under Access&RBAC.
Each item supports `id/label/section/route/icon/order/enabled/required/
permission`. Disabled items: hidden from nav, tabs, command palette,
breadcrumbs; purged from persisted state; direct `?tab=` access still
auth-checked with safe redirect. Shared infra never deleted with a page.

### 3.2 Invitation removal (frontend surface only)
Delete: `InvitationsTab.tsx`, `WORKSPACE_SECTIONS` entry + tab-id member,
`useInvitations`/`useInvitationMutations`, `organizationApi` invitation
methods, workspace `CrewInvitation` usages, `invitation.*` permission
catalog entries + system-role grants, workspace invitation tests/suites.
Keep: generated schema, backend invitation API, shared auth/user-mgmt.
Finish with repo-wide stale-reference search.

### 3.3 Canonical selectors (no new framework)
Standardize on `AsyncEntitySelector` + existing org `*Select.tsx` +
`ProductionRoleSelect`. Add `EntityMultiSelect` only if genuinely missing.
All selectors: server-side search/pagination over nested
`/api/organizations/{org}/...` routes, org-scoped, with
loading/empty/error/no-permission/disabled states, current-value loading,
clear-selection, and inline "+ Create" (with permission) that saves via
DRF, refreshes, auto-selects, and returns to the parent form. No
frontend-only relationship filtering (`getMyOrganizations` precedent:
server-filtered, ADR-0033 D5).

### 3.4 Relationship forms (only where the Django FK exists)
- People: department→Department dropdown, team→Team multi-select,
  office→Office dropdown, production role→scoped Role dropdown.
- Team: department dropdown, lead→Person selector, projects multi-select.
- Department: manager→Person selector (+ teams/projects selectors only
  where the model supports them).
- Office: manager→Person selector (+ teams/departments where supported).
- Project: client dropdown; vendors/departments/teams/people multi-selects;
  office dropdown where supported.
- Client/Vendor: projects multi-select where supported.
- Group: users + roles multi-selects. Role: scoped master+custom catalog.
- Master data: lifecycle-status dropdowns only where the config FK exists;
  scalar fields stay scalar. No invented relationships.
- Cascading: parent change clears invalid children, reloads options,
  revalidates via DRF. Org context is source of truth; cross-org
  selections rejected client-side AND server-side (frontend filtering is
  not security).

### 3.5 Backend (`../studiohub`, separate commits)
Add missing `validate()` org-guards for client/vendor/group/membership
(and contact/contract/calendar where FKs exist); confirm nested-route
queryset scoping; cross-org POSTs rejected per existing error contract
(400/403). Invitation backend untouched. Multi-org Person membership
model unchanged (membership-per-org loading on org switch).

### 3.6 Non-CRUD pages
Overview (read-oriented), Configuration (view/update/save/reset),
Security (create/rotate/revoke), Activity&Audit (view/search/filter/
inspect/export, immutable) stay out of generic CRUD. Entity pages follow
one interaction model (list → search/filter → create → edit → view →
archive/restore/delete → relationships → activity) via drawers/workspace,
not standalone pages.

## 4. Phases (agreed)
- Phase 1: Invitation removal + nav restructure (Projects→Business,
  optional-tab config) + route/persistence updates + dead-code removal.
- Phase 2: Selector standardization + relationship-driven forms +
  cascading + inline-create + CRUD consolidation per entity.
- Phase 3: Backend `validate()` gaps + cross-org tests + Playwright
  connected-entity workflow (Dept→Team→Office→Client→Vendor→Project→
  Person, then Org-B isolation) + CRUD/relationship test suites +
  production build + final stale-reference audit.

## 5. Definition of done
Spec §42 checklist: invitations gone from workspace; target nav shape;
Projects under Business; optional tabs safely removable; reusable CRUD;
all entity relationships via org-scoped DRF-populated selectors (no
hardcoded IDs/names, no free text for managed entities); backend rejects
cross-org; memberships isolated; RBAC via canonical permissions;
activity/audit intact; production workspace unaffected; no duplicate
framework; no god files; tests + Playwright green; build passes; no
stale invitation/registration references.

## 6. Self-review
- No TBD/TODO placeholders; requirements explicit.
- Internal consistency: removal list excludes generated schema and
  backend; selector standard reuses rather than rebuilds; master-data
  rule (no invented relations) constrains §3.4; phases ordered so nav
  exists before forms depend on it.
- Scope: single spec, three phased plans — appropriate for the size.
- Ambiguity resolved: backend path (`../studiohub`), delivery phasing,
  sections 1–3 + 5 approved 2026-10-06.
