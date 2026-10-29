# Organization Removal — Dependency Inventory & Migration Plan

Date: 2026-10-14
Scope: `studiohub-react` (frontend) + `../studiohub` (Django backend). Cross-repo refactor.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Remove Organization as a domain, data, API, authorization, and frontend dependency from StudioHub; make the platform the single tenant with platform-level and project-level access only.

**Architecture:** Delete the `organization` Django app and the frontend organization module/context/switcher. Relocate the entities that must survive into the documented boundaries: RBAC + security → `identity`; workforce + directory + reference data → `masterdata`; production keeps project scope only. No implicit default org, no replacement tenant abstraction.

**Tech Stack:** Django 6 + DRF (`uv run` from `backend/`), React 19 + TanStack Query + Zustand (`pnpm` from frontend root), pytest, Vitest, Playwright.

**Spec:** task brief "Refactor the StudioHub application to remove Organization" (2026-10-14). Inventories on disk:
- `~/.hermes/cache/scratch/backend-org-app-inventory.md` (apps/organization internals)
- `~/.hermes/cache/scratch/backend-cross-app-org-coupling.md` (coupling from other apps)
- `~/.hermes/cache/scratch/frontend-org-inventory.md` (frontend dependencies)

## Global Constraints

- No implicit default organization, no hidden org dependency, no replacement tenant abstraction.
- Forward-only migrations; never modify an applied migration. Existing data preserved: dedupe-by-code for RBAC/reference entities, re-point FKs, then drop org columns/tables last.
- Backend runs via `uv run`; commands: `uv run python manage.py check`, `uv run pytest`, `uv run ruff check .`. Frontend: `pnpm exec tsc --noEmit`, `pnpm vitest run`, `pnpm build`, `pnpm exec playwright test`.
- Preserve API conventions (DRF trailing slashes, pagination, error format), the documented layering (core < identity < masterdata < production/other domains), soft-delete semantics, and audit history rows.
- Superuser creation stays `createsuperuser` (secure, separate from ordinary user creation). Platform initialization is a new idempotent management command (`init_platform`) that seeds roles/permissions/statuses/departments/teams/offices/positions master data.
- Do not claim success for checks not actually executed.

## Review Focus

- A frontend path that still sends `X-Organization-Id` or reads `studiohub_active_org_id` after removal — every request must stop carrying the header.
- A permission check that still evaluates org membership (`hasOrgAccess`, `getUserMembership`, `checkUserHasOrgAccess`, `IsOrganizationMember`) after removal — access becomes platform-level (permission codes) + project-level (ProjectMembership).
- A query key still namespaced under `['organizations', ...]` — cache isolation must switch to project/platform roots.
- A production model that still requires an organization to create/read a project — projects must be creatable with no org context (task workflow step 4).
- A route that still deep-links to `/organizations/:id...` or requires `OrganizationRoute` — the app must boot and navigate with no org context.

---

## Phase A — Target Architecture (decisions locked here)

### A1. Backend domain re-homing

| Current location | Entity | Target | Disposition |
|---|---|---|---|
| organization | Organization, OrganizationMembership, OrganizationSettings, Branding, Billing, Invitation(already deleted) | — | DELETE (org management) |
| organization | Role, Permission, RolePermission, UserRole, Group, GroupMember, GroupRole | identity | MOVE (global RBAC, org FK dropped) |
| organization | UserSession, LoginHistory, PersonalAccessToken, ApiKey, UserPreference | identity | MOVE (global security, org FK dropped) |
| organization | Person, Client, Vendor, ClientContact, ClientContract, VendorContact, VendorContract | masterdata | MOVE (global directory; Person→identity.User FK kept, Department/Team/Office FKs kept) |
| organization | Department, Team, Office, Position | masterdata | MOVE (global reference data; merge with PlatformDepartment/PlatformPosition) |
| organization | WorkCalendar, WorkHours, Holiday, CalendarEvent | — | DELETE (org-management; scheduling app already owns CalendarEvent/Resource/Holiday) |
| masterdata | Organization*Config (7 models) + OrgConfigModel + CatalogModel.organization | — | DELETE config overrides; catalog becomes GLOBAL scope only, org FK dropped |
| masterdata | PlatformRole, PlatformGroup, PlatformDepartment, PlatformPosition | — | MERGE into identity.Role/Group and masterdata.Department/Position (dedupe by code) |
| production | org FK on Project + 18 more models; Asset.department/team, Task.team, Resource.department | — | DROP org FK; keep project FK; unique(org,code) → unique(code) after dedupe; keep ProjectMembership with role_ref → identity.Role |
| audit/settings/platform/deliveries/publishing/scheduling/intelligence | org FK columns, org-scoped viewset/admin bases, org permission checks | — | DROP org FK; switch to platform-level permission codes; replace `OrganizationScopedViewSet`/`OrganizationScopedModelAdmin` with new platform-scoped bases in core |
| core | OrganizationMiddleware, cache/log/error org partition, OrganizationScopedModel/EntityModel/OwnedModel, BaseSelector.scope_by_request(org) | — | REMOVE org; scope_by_request defaults to project; storage path drops org segment |

### A2. Backend API surface after removal

- `GET /api/v1/roles|groups|permissions|departments|teams|offices|positions|clients|vendors|people` (flat, no org) — owned by identity/masterdata.
- `GET /api/v1/platform/master-data/*` unchanged (already global).
- `/api/v1/organization/...`, `/api/organizations/...`, `/api/organizations/<org>/projects/...` trees removed.
- `/api/v1/auth/me` drops organization fields; `/api/v1/auth/me/organizations/` removed.
- `X-Organization(-Id)` headers ignored (middleware removed).

### A3. Frontend target

- Delete `src/core/organization`, `src/modules/organization` (132 files), `src/features/organizations`, `OrganizationSwitcher`, `OrganizationRoute`/`OrganizationMembershipRoute`/`OrgWorkspaceRedirect`, `OrgEntitySelector`, `types/organization.ts`.
- `ApiClient` stops sending `X-Organization-Id`; `purgeTenantState` removed; org keys gone from auth/token storage.
- RBAC: org dimension removed from `rbac.ts`/`scopeEngine.ts`/`routePermissionsRegistry.ts`/`usePermissionEvaluator.ts`/`accessControl.ts`/`useAccessManagementStore.ts`; access = permission codes (platform) + ProjectMembership (project).
- Query keys: `['organizations', orgId, ...]` → project-root (`['projects', id, ...]`) or platform-root (`['master-data', ...]`).
- Routes: projects are the primary production workspace; master data + studio reference data (people/departments/teams/offices/positions/clients/vendors) + RBAC + audit render directly in sidebar/platform sections (reusing the sidebar-first navigation introduced in 71f81fe).
- Forms/schemas/types: `organization_id`/`organizationId` removed from payloads and Zod schemas; autocomplete fields re-pointed to flat endpoints.
- e2e: org-scoped specs rewritten to platform/project flows; new spec covers the required workflow (superuser → init_platform → master data → users → project → production workflow, no org).

### A4. Migration sequencing (forward-only)

1. `identity`: add moved RBAC/security models (new tables, global), RunPython copy rows (dedupe by code where applicable), keep org FK columns nullable during transition where needed.
2. `masterdata`: add moved directory/workforce/reference models; merge Platform*; data-migrate; drop Organization*Config.
3. `production`: add new FK columns (role_ref → identity.Role; drop org FK on all models after backfilling via code match); dedupe Project codes globally; drop unique(org,code).
4. `audit`/`settings`/`platform`/`deliveries`/`publishing`/`scheduling`/`intelligence`: drop org FK columns (keep rows).
5. `organization` app: last migration drops remaining org-only tables; app removed from INSTALLED_APPS; delete app directory.
6. Back up the live DB (`pg_dump`) before running migrations; run `migrate` on a copy first in CI-equivalent check.

---

## Phase B — Backend implementation tasks

### Task B1: Platform-scoped bases in core (replaces org-scoped bases)

**Files:** `../studiohub/backend/apps/core/models/bases/scopes.py` (add `PlatformScopedModel`), `../studiohub/backend/apps/core/admin/base.py` (add `PlatformScopedModelAdmin` or repurpose), `../studiohub/backend/apps/core/api/viewsets/` (add `PlatformScopedViewSet`), `../studiohub/backend/apps/core/selectors/base.py` (`scope_by_request` defaults to project).

- [ ] Add platform-scoped base classes (no org), keep existing signatures where callers exist.
- [ ] `uv run python manage.py check` passes; core tests pass.

### Task B2: Identity absorbs RBAC + security

**Files:** `../studiohub/backend/apps/identity/models/{role,permission,role_permission,user_role,group,group_member,group_role,user_session,login_history,personal_access_token,api_key,user_preference}.py` (new), `../studiohub/backend/apps/identity/migrations/00XX_*.py`, serializers/viewsets/services/selectors/permissions updated; `apps/identity/permissions/organization.py` removed.

- [ ] Move models (org FK dropped); update `identity` imports across permission resolution, cache service, auth serializers, user directory.
- [ ] Data migration: copy Role/Permission/RolePermission/UserRole/Group/GroupMember/GroupRole/UserSession/LoginHistory/PAT/ApiKey/UserPreference rows, dedupe by code for RBAC, preserve user↔role links.
- [ ] `frontend_user` serializer drops organization_id/name/department; memberships → project memberships only.
- [ ] Remove `IsOrganizationMember`/`IsOrganizationOwner`; permission cache key drops org.
- [ ] Tests: identity suite green (`uv run pytest apps/identity`).

### Task B3: Masterdata absorbs directory/workforce/reference data

**Files:** `../studiohub/backend/apps/masterdata/models/{person,client,vendor,client_contact,client_contract,vendor_contact,vendor_contract,department,team,office,position}.py`, migrations, serializers/viewsets (flat `/api/v1/...`), drop `Organization*Config`, merge `Platform*`.

- [ ] Move models; data-migrate rows (dedupe by code); re-point Person→Department/Team/Office FKs.
- [ ] Catalog: `scope=GLOBAL` only; drop org FK + config override models + `OrganizationInitializationService` + `ProvisionOrganizationOnCreate` event handler.
- [ ] Flat API viewsets for clients/vendors/people/departments/teams/offices/positions (paths already consumed by frontend flat fallbacks).
- [ ] Tests: masterdata suite green.

### Task B4: Production drops org

**Files:** `../studiohub/backend/apps/production/models/*.py` (19 models), `migrations`, `api/viewsets/base.py`, selectors, `urls_project_scoped.py` (remove org segment), `ProjectMembership` role_ref re-point.

- [ ] Remove org FK from all models; Project unique(code) global after dedupe; indexes rebuilt on (project, ...).
- [ ] Asset.department/team, Task.team re-point to masterdata; ProjectMembership.role_ref → identity.Role (code-match backfill).
- [ ] `has_organization_access`/`resolve_organization_context` removed from production views/selectors; project-scoped permission checks.
- [ ] Tests: `uv run pytest apps/production` green.

### Task B5: Remaining apps drop org

**Files:** audit(8 models), settings(4), platform(2), deliveries(2), publishing(3), scheduling(3), intelligence(3) — models, migrations, viewsets (replace `OrganizationScopedViewSet` with platform base), admins (`OrganizationScopedModelAdmin` → platform base), selectors, serializers.

- [ ] Drop org FK columns (rows preserved); update permission checks to platform codes.
- [ ] `uv run pytest apps/audit apps/settings apps/platform apps/deliveries apps/publishing apps/scheduling apps/intelligence` green.

### Task B6: Core de-org

**Files:** `apps/core/middleware/organization.py` (delete), `logging/*`, `cache/api_response.py`, `api/exceptions/handlers.py`, `models/bases/{scopes,organization,ownership}.py`, `models/querysets/organization.py`, `filesystem/storage.py`, seed commands.

- [ ] Remove org header parsing, cache/log/error org partition, org base mixins, storage org path segment.
- [ ] Rewrite `seed_dev.py`/`seed_studiohub.py`/`seed_demo_data.py` without org; add `init_platform` management command (idempotent master-data seed; no org).
- [ ] `uv run pytest apps/core` green.

### Task B7: Delete organization app

**Files:** delete `../studiohub/backend/apps/organization/` entirely; `config/v1_urls.py`, `config/api_urls.py`, `config/settings/components/apps.py`, `config/settings/components/middleware.py` updated.

- [ ] Final org-app migration drops remaining org tables; remove app from INSTALLED_APPS; delete directory.
- [ ] `uv run python manage.py makemigrations --check` clean; `uv run pytest` full suite green; `uv run ruff check .` green.

### Task B8: Backend fresh-DB workflow validation

- [ ] Fresh DB: `createsuperuser` → `init_platform` → create users/roles → create project/client/vendor (no org) → production workflow endpoints → audit rows.
- [ ] `uv run python manage.py check` + full pytest + ruff on the fresh DB.

---

## Phase C — Frontend implementation tasks

### Task C1: API layer de-org

**Files:** `src/api/client/ApiClient.ts`, `src/api/masterDataApi.ts`, `src/modules/organization/api/organizationApi.ts` (delete; keep needed flat calls re-homed), `src/api/repositories/adapters/rest/*`, `src/core/api/*`.

- [ ] Remove `X-Organization-Id` header + `studiohub_active_org_id` reads; remove org query params.
- [ ] Re-home surviving API calls (clients/vendors/people/departments/teams/offices/positions/roles/groups/permissions/activity) to flat endpoints.
- [ ] `pnpm exec tsc --noEmit` green.

### Task C2: Core de-org (context, auth, permissions, master data, production)

**Files:** delete `src/core/organization/*`; `src/core/auth/*` (drop memberships/hasOrgAccess/getMembershipForOrg/currentMembership), `src/core/permissions/*` (org dimension out of rbac/scopeEngine/routePermissionsRegistry/usePermissionEvaluator/accessControl/useAccessManagementStore), `src/core/production/ProductionContext.tsx`, `src/core/masterData/useMasterData.ts`, `src/core/activity/activityService.ts`, `src/core/workspace/entityRegistry.ts`, `src/App.tsx` (provider removal), `src/core/testing/*`.

- [ ] No `useOrganization` consumers remain; permission evaluation is platform+project; query keys re-rooted.
- [ ] `pnpm vitest run src/core src/layouts` green.

### Task C3: Routes, layouts, navigation

**Files:** `src/routes/AppRoutes.tsx` (+ delete OrganizationRoute/OrganizationMembershipRoute/OrgWorkspaceRedirect), `src/layouts/Sidebar.tsx`, `src/layouts/Header.tsx`, `src/layouts/AppLayout.tsx`, delete `src/layouts/OrganizationSwitcher.tsx`, `src/routes/ProjectRoute.tsx`, `src/routes/PermissionRoute.tsx`, `src/routes/RoutePermissionGuard.tsx`.

- [ ] App boots with no org gate; projects primary workspace; sidebar studio/platform nav direct; no `/organizations/...` deep links.
- [ ] `pnpm vitest run src/routes` + route tests green.

### Task C4: Modules de-org

**Files:** delete `src/modules/organization/*`, `src/features/organizations/*`, `src/shared/relationships/OrgEntitySelector.tsx`; update access, people, departments, teams, offices, production, assets, episodes, audit, platform, reviews, tasks, versions, shots, workflows, scheduling, intelligence modules (hooks, query keys, forms, schemas, autocomplete).

- [ ] No module calls `useOrganization` or sends org params; forms/schemas have no organization fields.
- [ ] `pnpm vitest run src/modules` green.

### Task C5: Types, shared, scripts, mocks

**Files:** `src/types/organization.ts` (delete), `src/types/{auth,identity,production,masterData,audit}.ts`, `src/shared/crud/*`, `scripts/seed-platform-org-structure.ts` (rewrite or delete — its `src/mocks` import is already stale), `scripts/*` org refs.

- [ ] `pnpm exec tsc --noEmit` green; `pnpm vitest run` green; `pnpm build` green.

### Task C6: e2e + docs

**Files:** `e2e/*.spec.ts` org specs rewritten (organization-isolation → platform/project isolation; org-entity-views → flat entity views; etc.); new `e2e/platform-workflow.spec.ts` covering the required workflow; docs (`CLAUDE.md`, `docs/frontend/*`, `docs/api/*`, backend docs) updated; ADR for the org-removal decision.

- [ ] `pnpm exec playwright test` green (Django backend + seed available).
- [ ] Final residual-org scan: classify every remaining `organization` reference (intentional historical/docs vs code); report.

---

## Phase D — Final validation

- [ ] Backend: `uv run python manage.py check`, `uv run pytest`, `uv run ruff check .` on migrated + fresh DB.
- [ ] Frontend: `pnpm exec tsc --noEmit`, `pnpm vitest run`, `pnpm build`.
- [ ] Fresh-DB end-to-end: superuser → init_platform → master data → users → project/client/vendor creation (no org) → production workflow → audit.
- [ ] Residual reference report + risk list.
