# Organization Removal — Design (Approach A: Big-Bang, Fresh DB)

Date: 2026-10-15
Status: Approved design (brainstorming architectural path)
Scope: `studiohub-react` (frontend) + `../studiohub/backend` (Django, 12 apps)
Decisions locked: both repos together / fresh-DB-only (no data migration) / survivors kept as global per plan A1 / no implicit default org, no replacement tenant.

Related: `docs/architecture/ORGANIZATION_DEPENDENCY_AUDIT.md`, `docs/superpowers/plans/2026-10-14-organization-removal.md`.

## 1. Intent

Operate StudioHub with no Organization as domain entity, tenant boundary, runtime context, or data dependency. Boot path: `createsuperuser` → `init_platform` (idempotent seed) → master data → users/roles → projects → production workflows → audit. Every request stops carrying `X-Organization-Id`; every query stops filtering by org.

## 2. Architecture

Single tenant = the platform. Two access dimensions only: platform-level (permission codes) + project-level (`ProjectMembership`). `identity` owns global RBAC + security; `masterdata` owns global directory/reference data; `production` is project-scoped only; `core` loses all org partitioning. Survivors re-homed, org-management deleted, calendars deleted (scheduling app already owns them).

| Current | Disposition |
|---|---|
| Organization, Membership, Settings, Branding, Billing | DELETE |
| Role, Permission, RolePermission, UserRole, Group, GroupMember, GroupRole | MOVE → identity (org FK dropped) |
| UserSession, LoginHistory, PAT, ApiKey, UserPreference | MOVE → identity (org FK dropped) |
| Person, Client/Vendor + contacts/contracts | MOVE → masterdata (global directory) |
| Department, Team, Office, Position | MOVE → masterdata (merge Platform* by code) |
| WorkCalendar, WorkHours, Holiday, CalendarEvent (org app) | DELETE |
| Organization*Config + OrgConfigModel; CatalogModel.organization | DELETE overrides; catalog GLOBAL-only |
| Production org FK (Project + 18 models); Asset.dept/team, Task.team; ProjectMembership.role_ref | DROP org FK; keep project FK; role_ref → identity.Role |
| audit/settings/platform/deliveries/publishing/scheduling/intelligence org FKs + scoped bases | DROP org FK; platform permission codes; `PlatformScoped*` bases in core |
| OrganizationMiddleware, org cache/log/error partition, org bases, storage org segment | REMOVE |

## 3. Backend design

- **core:** delete `middleware/organization.py`; add `PlatformScopedModel` / `PlatformScopedViewSet` / `PlatformScopedModelAdmin`; `scope_by_request` defaults to project (never org); cache key drops org; storage path drops org segment; seeds rewritten without org; new idempotent `init_platform` command (roles/permissions/statuses/departments/teams/offices/positions).
- **identity:** new global RBAC + security models; remove `IsOrganizationMember`/`IsOrganizationOwner`, org permission module; cache key drops org; `frontend_user` serializer drops org fields, memberships → project only; `/auth/me/organizations/` removed.
- **masterdata:** moved directory/reference models with flat `/api/v1/...` viewsets; catalog GLOBAL-only; drop `OrganizationInitializationService` + provision-on-create handler.
- **production:** remove org FK from all 19 models; `unique(org,code)` → `unique(code)`; indexes on `(project,…)`; strip `resolve_organization_context`/`has_organization_access`; project-membership checks only; `urls_project_scoped.py` loses org segment.
- **Remaining apps:** drop org FK columns (rows dropped with fresh DB — no preservation logic); permission checks → platform codes.
- **Delete `apps/organization/`** last; remove from INSTALLED_APPS, URL configs, middleware list. Fresh-DB migrations only (squash, no RunPython backfills).
- Conventions preserved: DRF trailing slashes, pagination, error format, soft-delete, audit rows, layering core < identity < masterdata < production.

## 4. Frontend design

- **Delete:** `src/core/organization/*`, `src/modules/organization/*` (132 files), `src/features/organizations/*`, `OrganizationSwitcher`, `OrganizationRoute`/`OrganizationMembershipRoute`/`OrgWorkspaceRedirect`/`AccessWorkspaceRedirect`, `OrgEntitySelector`, `types/organization.ts`.
- **ApiClient (`ApiClient.ts:39-42`):** stop sending `X-Organization-Id`; remove `studiohub_active_org_id` reads; drop org query params; re-home surviving calls to flat endpoints.
- **Core:** `App.tsx:18` drops `OrganizationProvider`; auth drops memberships/`hasOrgAccess`/`getMembershipForOrg`; permissions drop org dimension (`rbac.ts`, `scopeEngine.ts`, `routePermissionsRegistry.ts`, `usePermissionEvaluator.ts`, `accessControl.ts`, `useAccessManagementStore.ts`); query keys `['organizations', orgId,…]` → `['projects', id,…]` / `['master-data',…]`; `purgeTenantState` removed.
- **Routes (`AppRoutes.tsx:116-395`):** remove `OrganizationRoute` gate; delete `/organizations/:id…` + `/organizations/:organizationId/projects/…` deep links (keep flat `/projects/:id…` variants already present); entity list routes render directly instead of `OrgWorkspaceRedirect`; sidebar studio/platform nav direct; projects primary workspace.
- **Modules/forms:** no `useOrganization`, no `organization_id` in payloads/Zod schemas; autocompletes re-point to flat endpoints.
- **e2e:** rewrite org specs to platform/project flows; new spec covers superuser → init_platform → master data → users → project → production workflow, no org.

## 5. Data flow (after)

Boot: login (JWT/PAT/API key, user-scoped) → no org resolution → permission = global codes + project memberships. Reads: viewset `PlatformScoped` / project-scoped queryset, no header. Writes: no `organization_id` stamped. Switch/cache: no org switch, no cache wipe on org change; React Query keyed by project/platform. Fresh-DB setup: `createsuperuser` → `init_platform` → create users/roles → create project/client/vendor → production endpoints → audit rows.

## 6. Error handling / edge cases

- Stale `localStorage studiohub_active_org_id` ignored then purged on load (no auto-correct to first org).
- Requests still sending `X-Organization-Id` → ignored server-side (middleware removed); no 404-on-unknown-org path remains.
- Permission denials reference missing platform code or project membership (never "no org access").
- Fresh-DB-only risk accepted: no rollback for live org data; `pg_dump` backup step retained before migrate in runbook but no backfill code.
- Dual-FK skew class eliminated (single project FK). Nullable-org legacy rows (Person/Position/Group/Role NULLs) become plain global rows.

## 7. Testing & validation

- Backend (fresh DB): `manage.py check`, `pytest`, `ruff check .`; workflow validation createsuperuser → init_platform → users/roles → project/client/vendor → production → audit.
- Frontend: `tsc --noEmit`, `vitest run`, `build`; route tests without org gate; e2e `playwright test` (Django backend + seed).
- Residual scan: every remaining `organization` string classified (historical/docs vs code); zero runtime code refs required. Known pre-existing `apps/core` failures (openapi schema, bare-array envelopes, admin registry) re-verified as unrelated.
- Review focus: any path still sending/reading org header/storage, any `hasOrgAccess`/`IsOrganizationMember` check, any `['organizations',…]` key, any project create requiring org, any `/organizations/:id` deep link.

## 8. Sequencing (big-bang within layers)

1. core platform bases + middleware/cache/storage de-org. 2. identity absorbs RBAC/security. 3. masterdata absorbs directory/reference. 4. production drops org. 5. remaining apps drop org. 6. delete organization app + configs. 7. frontend API/core/routes/modules/types/mocks. 8. e2e + docs + ADR + residual report. Backend steps 1–6 land as one reviewable unit on fresh DB; frontend follows in the same session (both repos together).
