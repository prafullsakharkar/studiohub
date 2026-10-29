# StudioHub — Backend ↔ Frontend Consolidation Audit Report

Date: 2026-10-07
Scope: `../studiohub/backend` (Django, 2007 py files excl. venv, 1968 in apps/) ↔ `studiohub-react/src` (757 files: 505 tsx + 250 ts + 1 css)
Method: evidence-backed inventory via parallel agents + targeted model/type reads. No code modified.

Backend repo: `/home/prafull.sakharkar/Repository/github/studiohub`
Frontend repo: `/home/prafull.sakharkar/Repository/github/studiohub-react`

---

## 1. Canonical Domain Map

| Concept | Canonical implementation | Evidence |
|---|---|---|
| User (auth identity) | `backend/apps/identity/models/user.py:12` `User` + `profile.py:13` `Profile` → `GET /api/v1/auth/me/` → frontend `src/types/identity.ts:43 User` | Global, no org FK; USERNAME_FIELD=email; display fields delegate to Profile |
| Person (workforce profile) | `backend/apps/organization/models/person.py:11` `Person` → `PersonViewSet` (`/people`, `/api/organizations/<org>/people/`) → `src/types/organization.ts:103 Person` → `modules/people/pages/PersonWorkspacePage.tsx` | Org-scoped `LifecycleModel`, role→Position, dept/team/office FKs; NO FK to User (loose email match) |
| Team (workforce) | `backend/apps/organization/models/team.py:8` `Team` → `TeamViewSet` → `src/types/organization.ts Team` → `modules/teams/pages/TeamWorkspacePage.tsx` + `TeamSelect` | `department PROTECT`, `lead→Person`, capacity/utilization; zero User/Role/Permission links |
| Group (authorization) | `backend/apps/organization/models/group.py:12` `Group` + `group_member.py` + `group_role.py` → `GroupViewSet` → `modules/access/components/GroupsManagementSection.tsx` | `users M2M via GroupMember`, `Group→Role via GroupRole`; completes User—Group—Role path |
| Role (RBAC) | `backend/apps/organization/models/role.py:10` `Role` + `permission.py` + `user_role.py` + `role_permission.py` → `RoleViewSet` → `src/types/identity.ts:160 Role` → `core/permissions/rbac.ts` | code/scope/role_type, parent; zero Person/Dept links |
| Production Role (job) | `backend/apps/organization/models/position.py:11` `Position` (NOT "ProductionRole" — 0 hits backend) → `PositionViewSet` → `src/types/organization.ts:89 Position` → `ProductionRoleSelect.tsx` | scope global_master/organization_custom, dept FK, level/is_managerial; zero Permission/User links |
| Organization Membership | `backend/apps/organization/models/membership.py:12` `OrganizationMembership` → `OrganizationMembershipViewSet` → `src/types/identity.ts:8` | Unique(user,org); role→Role PROTECT; status + employment_type; anchored on User |
| Project Membership | `backend/apps/production/models/project_membership.py:18` `ProjectMembership` → `ProjectMembersView` → `src/types/identity.ts:174` | unique(project,user); role Char + roles JSON; show-scoped via scope field |
| Group Membership | `GroupMember` + `GroupRole` + `UserRole` (no separate Team/Dept membership models exist) | Team/Dept access via OrganizationMembership.department/team/office optional FKs |
| Permission | `backend/apps/organization/models/permission.py:16` `Permission` (code unique, module/action/category) + per-app `constants/permissions.py` → `PermissionViewSet` → `core/permissions/*` | Enforcement: `core/permissions/base.py` + `identity/permissions/permission.py:HasPermission` |
| Activity (product feed) | `backend/apps/audit/models/activity.py:15` `Activity` → `ActivityViewSet` → `core/activity/activityService.ts` + `ActivityTimeline.tsx` + `*ActivityTab` | activity_type page_view/feature_usage/..., user FK CASCADE |
| Audit (compliance) | `backend/apps/audit/models/audit_log.py:14` `AuditLog` → `AuditLogViewSet` → `modules/audit/*` + `types/audit.ts` | action/severity/target_type polymorphic; actor SET_NULL (preserved after user delete) |
| Department | `organization/models/department.py` → `DepartmentViewSet` → `modules/departments/*` + `DepartmentSelect` | parent self PROTECT, manager→Person; Team.department nests under it |
| Office | `organization/models/office.py` → `OfficeViewSet` → `modules/offices/*` + `OfficeSelect` | Standard org entity |
| Client / Vendor + Contacts | `client.py` + `client_contact.py` + `client_contract.py` (same for vendor) → `ClientViewSet`/`ContactViewSet` → `modules/organization/*Client*`/`*Vendor*` | Contacts are EntityModel with org+client/vendor FK + denormalized name/role/email/phone; NO FK to Person |
| Organization Settings | `organization/models/organization_settings.py` (typed singleton: locale/pipeline flags) + `settings/models/organization.py` (EAV: SettingDefinition+value) | Overlapping domain, different pattern — needs governance, not merge |
| Show | `production/models/show.py` → `ShowViewSet` → routes `/shows/:showId` | Project child scope |

Key negative findings (do NOT exist, so no consolidation needed):
- No `ProductionRole` model (0 hits); canonical job role = `Position`.
- No `TeamMembership`, `DepartmentMembership`, `ShowMembership` models; membership = Org + Project + Group triple.
- No `src/**/mockAuthGuard.*` implementation (stale docs refs only).
- No standalone `/users` route (`grep path="/users"` = 0); Users surface = access-workspace `UserAccessSection`.

---

## 2. MERGE (none required at model level — merges are frontend-only)

### M1. Frontend `can()` surfaces → one canonical entry
- A → B: `rbac.ts:775 can()` + `accessControl.ts:112 accessControl.can()` + `enterprisePermissions.canPerformAction` → `core/permissions/can.ts:68 can()` (delegates to `evaluateUserPermission`).
- Reason: 3+ string-based wrappers over the same evaluator with divergent signatures invite inconsistent scope passing.
- Migration: re-export legacy names from `can.ts` as deprecated aliases; update call sites in `Sidebar`, `CommandPalette`, `TestingPage`, `PermissionRoute`; keep `evaluateUserPermission` as engine.
- Affected files: `src/core/permissions/{can,rbac,accessControl,enterprisePermissions}.ts`, ~8 call sites.
- Affected APIs/tests: none (frontend-only); tests `core/permissions/__tests__/*`, `routes/__tests__/RoutePermissionGuard.test.tsx`.

### M2. Frontend admin checks → one canonical check
- A → B: `isUserAdmin` (role-name, `rbac.ts:293`) + `isSuperAdminUser` (`accessControl.ts:23`) → keep `isPlatformSuperuser` (`rbac.ts:805`, strict `is_superuser`) for break-glass ONLY + one `hasElevatedAccess(user, orgId)` for org-admin checks backed by membership/permission evaluation.
- Reason: role-string matching (`role.includes('admin')`, `role === 'Organization Owner'`) duplicates the RBAC engine and drifts from backend `HasPermission`.
- Migration: replace inline `user.role === ...` in `scopeEngine`, `resource/field/workflow/externalAccessEngine`, `PermissionControl roleStr.includes` with engine calls.
- Affected files: `src/core/permissions/*Engine.ts`, `PermissionControl.tsx`, `identity.ts getUserMembershipType`.
- Tests: `externalAccessEngineStrictSuperuser.test.ts`, `isPlatformSuperuser.test.ts`.

### M3. Simulation stores → single source
- A → B: `usePermissionStore.currentRoleId/customOverrides` + `useRoleStore.activeRoleId` → session `AuthProvider.user/memberships` as authority; simulator becomes an explicit opt-in overlay (already `PermissionSimulatorSection` exists in access module).
- Reason: two stores default to `role-org-admin` and `PermissionControl.tsx:76-78` reads simulation state for production gating.
- Migration: gate simulator behind explicit flag; default OFF in prod paths.
- Affected: `src/shared/stores/usePermissionStore.ts`, `src/core/permissions/roleStore.ts`.

---

## 3. KEEP_SEPARATE (with explicit domain distinction)

| A ↔ B | Reason | Shared infra |
|---|---|---|
| User ↔ Person | Auth identity (global, login lifecycle) vs workforce profile (org-scoped, HR lifecycle). Backend proves: User has no org FK; Person has no User FK; memberships anchor on User. | Frontend: Users = access/admin view (`UserAccessSection`); People = business directory (`PersonWorkspacePage`, 10 tabs). Both read same `peopleList` source — keep views, unify data hook. Add optional `Person.user_id` link (frontend-only today) only if backend adds FK — NEEDS_REVIEW. |
| Team ↔ Group | Team = workforce/planning (`lead→Person`, capacity); Group = authorization (`users M2M`, `Group→Role`). | Distinct ViewSets/routes; Teams have `/teams*` routes + workspace; Groups live under `/access/:section` + `GroupsSection` master-data. Remove second Groups surface (`platform/.../GroupsSection`) OR mark it as read-only mirror — see NEEDS_REVIEW. |
| Role (RBAC) ↔ Position (job) | Role bears permissions; Position bears dept/level/scope, zero permission links. | `Role` → `rbac.ts` + `GroupsManagementSection`; `Position` → `ProductionRoleSelect` + `Person.role_id`. Fix naming: rename UI label "Production Role" → "Position" to match backend; keep `Person.role` display string derived from Position. |
| OrganizationMembership ↔ ProjectMembership ↔ GroupMember/UserRole | Org grant vs project/show grant vs group/role assignment; different unique constraints and lifecycles. | Consistent pattern already: User-anchored edges; do not collapse. Fix `ProjectMembership.status` free-string → constrained choices (backend). |
| Permission ↔ Capability text | `domainPermissions.ts` `capabilities` string in `vendor.update` is display text, not authz. | Keep; rename field to `description` to avoid confusion. |
| Activity ↔ AuditLog | Product analytics feed (user FK CASCADE, page_view taxonomy) vs compliance trail (actor SET_NULL, action/severity/target polymorphic). | Separate ViewSets/tables; per-workspace `*ActivityTab` reads Activity; `modules/audit/*` reads AuditLog. Compliance requires separation. |
| ClientContact/VendorContact ↔ Person | External CRM contacts (scoped to Client/Vendor, portal_access) vs internal roster (dept/team/office/Position). Parallel shape but different ownership/lifecycle. | Keep separate; do NOT FK contacts to Person without polymorphism design (NEEDS_REVIEW if product wants unified directory). |
| OrganizationSettings (typed) ↔ settings.OrganizationSetting (EAV) | Fixed locale/pipeline profile vs extensible key-value definitions. Table-name collision (`organization_organization_settings` vs `organization_settings`) is confusing but patterns differ. | Governance rule: fixed known keys → typed model; custom/extensible → EAV. Document ownership; no merge. |
| Department ↔ Team | Parent/child workforce hierarchy (Team.department PROTECT), not duplicates. | Keep; `DeptTeamsTab` + `TeamSelect` canonical selectors. |

---

## 4. REMOVE

| Concept | Reason | Replacement |
|---|---|---|
| Second Groups surface `modules/platform/admin/masterData/OrgStructure/GroupsSection.tsx` (if proven mirror) | Two managers for same `Group` collection (`GroupsManagementSection` is full CRUD + member/role assignment) | Canonical: `GroupsManagementSection`; make platform surface read-only link or delete. Verify no unique logic first (NEEDS_REVIEW item N3). |
| Legacy/compat ViewSets (`organization/api/viewsets/legacy.py`, `identity/api/views/auth_compat.py`, `urls_legacy.py`) after frontend migrates to namespaced routers | Permanent dual contracts (`/api/v1/organization/*` flat vs namespaced + nested `/api/organizations/<org>/*`) | Canonical: namespaced routers + nested org routes; keep legacy only with sunset date. Backend decision. |
| Inline role-string authz (`role ===`, `roleStr.includes('artist')`, `user.role === 'Vendor Artist'` etc.) | Duplicates RBAC engine; backend `HasPermission` is authoritative | `can(permission, scope, resource)` engine calls (M2). |
| `GET all` selector patterns / hard-coded values / free-text entity relationships | Violates selector rules (org-scoped, permission-aware, server search + pagination) | Canonical `AsyncEntitySelector` + `BaseRESTAdapter` + DRF filtersets (already exist per-entity). |

---

## 5. NEEDS_REVIEW (decision required)

- N1. `Person ↔ User` link: frontend `Person.user_id` exists but backend has no FK (loose email match). Decision: add nullable `Person.user FK` backend + migration, or drop `user_id` from frontend and document email-match reconciliation? Owner: backend.
- N2. `ProjectMembership.status` free string (`default="Active"`) vs `OrganizationMembership.status` choices. Decision: constrain to choices + migration.
- N3. `GroupsSection` (platform master-data) vs `GroupsManagementSection` (access): confirm whether platform surface has unique logic (e.g. system groups seeding) or is pure mirror. Decision: delete vs read-only embed.
- N4. `ClientContact/VendorContact` unification: does product want a unified people directory (internal + external contacts)? If yes, design `Contactable` polymorphism; if no, keep separate (recommended).
- N5. `OrganizationSettings` vs EAV governance + table-name collision rename (`organization_settings` → `setting_values`?). Backend decision; frontend unaffected (separate endpoints).
- N6. `ShowMembership`: backend ADR-0033 models show scope via `ProjectMembership.show+scope`, no separate model. Confirm product doesn't need independent show grants — current pattern sufficient.
- N7. `ProjectMembership.role` Char + `roles` JSON vs FK to `Role`: denormalized strings duplicate role codes. Decision: FK to Role with data migration, or document string-role as intentional snapshot.
- N8. `role_permission` table naming anomaly (`organization_role_permissions` plural vs singular rest). Rename in migration if desired.

---

## 6. Backend ↔ Frontend canonical mapping (per entity)

```text
Django Model → Serializer → API resource → Frontend type → Feature → Query key → Form → Selector → Permission
```

| Entity | Backend model | API (canonical) | Frontend type | Feature | Query key | Form | Selector | Permission |
|---|---|---|---|---|---|---|---|---|
| User | `identity/user.py` | `/api/v1/auth/me/`, `/api/v1/identity/users/` | `types/identity.ts User` | `modules/auth` + `access/UserAccessSection` | `['users']` | Login/mgmt via access | `PersonSelect` (roster) — no User picker needed | `user.*` (`identity/constants`) |
| Person | `organization/person.py` | `/api/v1/organization/.../persons/`, nested `/api/organizations/<org>/people/` | `types/organization.ts Person` | `modules/people/*Workspace*` | `['people', orgId]` | `CreatePerson/EditPersonPage` | `PersonSelect` | `person.*` |
| Team | `organization/team.py` | `.../teams/` | `types/organization.ts Team` | `modules/teams/*` | `['teams', orgId]` | `CreateTeam/EditTeamPage` | `TeamSelect` | `team.*` |
| Group | `organization/group.py` | `.../groups/` | `types/organization.ts AccessGroup` | `access/GroupsManagementSection` | `['groups', orgId]` | Group modals in section | — (managed, not picked) | `group.*` |
| Role | `organization/role.py` | `.../roles/` + `.../permissions/` `.../user-roles/` | `types/identity.ts Role` | `access/RolesWorkspaceSection` + `RoleEditorModal` | `['roles', orgId]` | `RoleEditorModal` | `RoleSelector` (access) | `role.*`, `permission.*` |
| Position | `organization/position.py` | `.../positions/` | `types/organization.ts Position` | `ProductionRoleSelect` | `['positions', orgId]` | Master-data PositionsTab | `ProductionRoleSelect` | `position.*` |
| OrgMembership | `organization/membership.py` | `.../memberships/` | `types/identity.ts OrgMembership` | `OrganizationContext` + access | `['memberships', orgId]` | Invitation flow | — | `membership.*` |
| ProjectMemb. | `production/project_membership.py` | `/api/organizations/<org>/projects/<project>/members/` | `types/identity.ts ProjectMembership` | `access/ProjectAccessSection` | `['projects', pid, 'members']` | Add-member via project API | — | `project.member.*` |
| Department | `organization/department.py` | `.../departments/` | `types/organization.ts DepartmentEntity` | `modules/departments/*` | `['departments', orgId]` | `Create/ EditDepartmentPage` | `DepartmentSelect` | `department.*` |
| Client/Vendor | `organization/client.py` etc. | `/api/v1/clients/`, `/vendors/` | `types/organization.ts Client/Vendor` | `modules/organization/*Workspace*` | `['clients'/'vendors', orgId]` | `Client/VendorFormPage` | `Client/Contact/VendorSelect` | `client.*`, `vendor.*` |
| Activity | `audit/activity.py` | `/api/v1/activity/` | `types/organization.ts ActivityLogItem` | `ActivityTimeline` + `*ActivityTab` | `['activity', orgId]` | — (read-only) | — | `activity.view` |
| Audit | `audit/audit_log.py` | `/api/v1/audit/...` | `types/audit.ts AuditLog` | `modules/audit/*` | `['audit', ...]` | — (read-only) | — | `audit.*` |

API consolidation: canonical = namespaced routers + nested org routes (`/api/organizations/<org>/*`) + project-scoped (`urls_project_scoped.py`); flat `/api/v1/organization/*` = legacy compat (sunset, don't extend). No `GET all` — use DRF filtersets (exist per entity) + server search/pagination; frontend `AsyncEntitySelector` + `BaseRESTAdapter`.

---

## 7. File-count & duplication metrics (before)

- Frontend `src`: 757 files (505 tsx, 250 ts). Duplication counts: `User*.tsx` 1, `Person*.tsx` 14, `Team*.tsx` 11, `Group*.tsx` 2, `*Role*.tsx` 9.
- Backend `backend/`: 2007 py files excl. `.venv` (1968 in `apps/`).
- Expected post-consolidation delta (frontend-only, model layer needs no merge): −5 to −10 files (permission-helper dedup M1–M3, one Groups surface, `Person.role` string removal, capability rename). Backend: no file deletion recommended except sunset legacies (separate decision). Re-measure with `find src -type f | wc -l` after implementation.

---

## 8. Migration strategy (per consolidation M1–M3 + R removals)

1. Canonical implementation identified above — no model migration needed.
2. Migrate consumers (call sites → `can.ts`; role-strings → engine).
3. Migrate API/frontend types (Position label rename; `Person.role` derived).
4. Migrate relationships (selectors already canonical — no change).
5. Migrate permissions (simulator opt-in; `HasPermission` stays backend authority).
6. Migrate navigation/routes (no change — Sidebar has no Users/People/Teams/Groups entries; org-tabs + `/access/:section` already canonical).
7. Migrate tests (permission/route guard tests listed in M1–M2).
8. Remove obsolete implementation (one Groups surface; legacy aliases).
9. Validate: `tsc --noEmit`, `vitest run`, `biome check src`, Playwright `e2e/consolidation.spec.ts` + isolation specs (needs Django at `VITE_API_URL`).

---

## 9. Testing plan

- Backend (in `../studiohub`): `pytest backend/apps/organization backend/apps/production backend/apps/identity backend/apps/audit` — permission tests, org/project isolation, membership validation. (Not run here — separate repo session.)
- Frontend: `npm run typecheck`, `npm run test`, contract `api:validate`.
- Playwright (needs Django): Login → org selection → People → Users(access) → Teams → Groups → Roles → Project members → selector CRUD → permission denial → cross-org denial → direct-URL denial.
