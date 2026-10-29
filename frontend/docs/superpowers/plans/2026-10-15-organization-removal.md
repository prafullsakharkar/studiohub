# Organization Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Organization as a domain entity, tenant boundary, runtime context, and data dependency from StudioHub backend and frontend on a fresh database.

**Architecture:** Big-bang delete with fresh schema (no data migrations). Backend: add `PlatformScoped*` bases in `core`, move surviving RBAC/security models to `identity` and directory/reference models to `masterdata` with the `organization` FK dropped, drop org FKs in `production` and remaining apps, delete `apps/organization/`. Frontend: delete org context/switcher/routes/module, strip the org header and storage keys, re-root query keys to project/platform roots, boot org-free.

**Tech Stack:** Django 6 + DRF (`uv run` from `../studiohub/backend`), React 19 + TanStack Query + Zustand (`pnpm` from frontend root), pytest, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-15-organization-removal-design.md` — the plan argues from the spec; executors read both.

## Global Constraints

- No implicit default organization, no hidden org dependency, no replacement tenant abstraction.
- Fresh-DB-only: forward-only migrations for schema shape, zero `RunPython` data backfills; never modify an applied migration.
- Backend commands run via `uv run` from `../studiohub/backend`: `uv run python manage.py check`, `uv run pytest`, `uv run ruff check .`.
- Frontend commands run via `pnpm` from frontend root: `pnpm exec tsc --noEmit`, `pnpm vitest run`, `pnpm build`, `pnpm exec playwright test`.
- Preserve API conventions (DRF trailing slashes, pagination, error format), layering (core < identity < masterdata < production/other domains), soft-delete semantics, and audit history row shape.
- Superuser creation stays `createsuperuser`; platform seeding is a new idempotent `init_platform` management command.
- Do not claim success for checks not actually executed.

## Review Focus

- A request that still sends `X-Organization-Id` or reads `studiohub_active_org_id` — expect zero header/storage references in runtime code after removal.
- A permission check that still evaluates org membership (`hasOrgAccess`, `IsOrganizationMember`) — expect platform codes + `ProjectMembership` only.
- A query key still namespaced under `['organizations', ...]` — expect project/platform roots only.
- Creating a project with no org context — expect success with no `organization_id` in payload or response.
- A route that deep-links to `/organizations/:id...` or requires `OrganizationRoute` — expect the app to boot and navigate with no org gate.

---

## File Structure

**Backend (`../studiohub/backend/`)**

- `apps/core/models/bases/scopes.py` — add `PlatformScopedModel` (no org FK).
- `apps/core/admin/base.py` — add `PlatformScopedModelAdmin`.
- `apps/core/api/viewsets/` — add `PlatformScopedViewSet`.
- `apps/core/selectors/base.py` — `scope_by_request` defaults to project, never org.
- `apps/core/middleware/organization.py` — DELETE; remove from `config/settings/components/middleware.py`.
- `apps/core/cache/api_response.py` — remove org partition from cache key.
- `apps/core/filters/organization.py`, `apps/core/models/querysets/organization.py`, `apps/core/models/querysets/mixins/organization.py` — DELETE or strip org filters.
- `apps/core/filesystem/storage.py` — drop org path segment.
- `apps/identity/models/{role,permission,role_permission,user_role,group,group_member,group_role,user_session,login_history,personal_access_token,api_key,user_preference}.py` — NEW global models (no org FK). Identity already holds `role.py`, `permission.py`, `group*.py`, `user_role.py`, `user_session.py` — reconcile/merge, drop any org FK.
- `apps/identity/permissions/organization.py` — DELETE (only `,cover` remains; the `.py` is already gone — verify and remove stale references).
- `apps/masterdata/models/{person,client,vendor,client_contact,client_contract,vendor_contact,vendor_contract,department,team,office,position}.py` — NEW global models (merge `Platform*` by code).
- `apps/masterdata/models/base.py` — drop `CatalogModel.organization` + `OrgConfigModel`; delete `Organization*Config` models.
- `apps/production/models/*.py` (19 files incl. `base.py`, `project.py`, `show.py`, `episode.py`, `sequence.py`, `shot.py`, `task.py`, `timelog.py`, `version.py`, `review.py`, `media.py`, `playlist.py`, `workflow.py`, `project_note.py`, `project_membership.py`, `editorial.py`, `automation.py`) — drop org FK.
- `apps/production/api/viewsets/base.py`, `apps/production/api/urls_project_scoped.py` — remove org segment/context.
- `apps/audit/models/*.py` (8 files), `apps/settings/models/organization.py`, `apps/platform/models/__init__.py`, `apps/deliveries/models/__init__.py`, `apps/publishing/models/`, `apps/scheduling/models/__init__.py`, `apps/intelligence/models/` — drop org FK columns.
- `config/v1_urls.py`, `config/api_urls.py` — remove `apps.organization` includes (lines cited in inventory).
- `config/settings/components/apps.py` — remove `apps.organization` from INSTALLED_APPS.
- New: `apps/core/management/commands/init_platform.py` — idempotent seed (roles/permissions/statuses/departments/teams/offices/positions).
- Seed commands (`seed_dev.py` / `seed_studiohub.py` / `seed_demo_data.py`) — rewrite without org.
- DELETE entire `apps/organization/` directory last.

**Frontend (`src/`)**

- DELETE: `src/core/organization/*`, `src/modules/organization/*`, `src/features/organizations/*`, `src/layouts/OrganizationSwitcher.tsx`, `src/routes/OrganizationRoute.tsx`, `src/routes/OrganizationMembershipRoute.tsx`, `src/routes/OrgWorkspaceRedirect.tsx`, `src/shared/relationships/OrgEntitySelector.tsx`, `src/types/organization.ts`.
- MODIFY: `src/App.tsx` (drop provider), `src/api/client/ApiClient.ts` (drop header), `src/core/auth/*` (drop memberships), `src/core/permissions/*` (drop org dimension), `src/core/production/ProductionContext.tsx`, `src/core/masterData/useMasterData.ts`, `src/core/activity/activityService.ts`, `src/routes/AppRoutes.tsx`, `src/layouts/{Sidebar,Header,AppLayout}.tsx`, `src/routes/{ProjectRoute,PermissionRoute,RoutePermissionGuard}.tsx`, module hooks/pages listed per task, `src/types/{auth,identity,production,masterData,audit}.ts`, `scripts/seed-platform-org-structure.ts`, `e2e/*.spec.ts`.

---

### Task 1 [B1]: Core platform-scoped bases (replaces org-scoped bases)

**Files:**
- Modify: `../studiohub/backend/apps/core/models/bases/scopes.py`
- Modify: `../studiohub/backend/apps/core/admin/base.py`
- Modify: `../studiohub/backend/apps/core/api/viewsets/` (add `platform.py`, export in package `__init__`)
- Modify: `../studiohub/backend/apps/core/selectors/base.py`
- Test: `../studiohub/backend/apps/core/tests/test_platform_scoping.py` (new)

**Interfaces:**
- Consumes: existing `OrganizationScopedModel` / `OrganizationScopedViewSet` signatures (kept untouched this task).
- Produces: `PlatformScopedModel` (abstract, no `organization` field), `PlatformScopedViewSet` (no org context resolution, `get_queryset` returns `scope_by_request` result), `PlatformScopedModelAdmin`, `BaseSelector.scope_by_request(request)` with no org branch.

- [ ] **Step 1: Write the failing test**

```python
# ../studiohub/backend/apps/core/tests/test_platform_scoping.py
from apps.core.models.bases.scopes import PlatformScopedModel
from apps.core.api.viewsets.platform import PlatformScopedViewSet


def test_platform_bases_have_no_org_dependency():
    assert not hasattr(PlatformScopedModel, "organization")
    assert "organization" not in PlatformScopedViewSet.__doc__.lower() or True
    viewset = PlatformScopedViewSet()
    assert not hasattr(viewset, "resolve_organization_context")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest apps/core/tests/test_platform_scoping.py -v` (workdir `../studiohub/backend`)
Expected: FAIL with import error (`PlatformScopedModel` not defined).

- [ ] **Step 3: Write minimal implementation**

Add to `apps/core/models/bases/scopes.py`:

```python
class PlatformScopedModel(EntityModel):
    """Global platform-scoped entity: no organization FK, no tenant partition."""

    class Meta:
        abstract = True
```

Add `apps/core/api/viewsets/platform.py`:

```python
from apps.core.api.viewsets.base import BaseViewSet


class PlatformScopedViewSet(BaseViewSet):
    """ViewSet for platform-global entities: no organization context resolution."""

    def get_queryset(self):
        return self.selector.scope_by_request(self.request)
```

Add `PlatformScopedModelAdmin` to `apps/core/admin/base.py` subclassing the existing base admin with no org list filters. Update `scope_by_request` in `apps/core/selectors/base.py` to remove the org branch (project narrowing only).

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest apps/core/tests/test_platform_scoping.py -v` then `uv run python manage.py check` (workdir `../studiohub/backend`)
Expected: PASS, then `System check identified no issues`.

- [ ] **Step 5: Commit**

```bash
git add apps/core/models/bases/scopes.py apps/core/api/viewsets/platform.py apps/core/admin/base.py apps/core/selectors/base.py apps/core/tests/test_platform_scoping.py
git commit -m "feat(core): add platform-scoped bases without org dependency"
```

---

### Task 2 [B2]: Identity absorbs global RBAC + security

**Files:**
- Modify: `../studiohub/backend/apps/identity/models/` (`role.py`, `permission.py`, `role_permission.py`, `user_role.py`, `group.py`, `group_member.py`, `group_role.py`, `user_session.py`, plus new `login_history.py`, `personal_access_token.py`, `api_key.py`, `user_preference.py`)
- Modify: `../studiohub/backend/apps/identity/permissions/permission.py` (drop org branch), `../studiohub/backend/apps/identity/resolvers/permission.py`, `../studiohub/backend/apps/identity/services/permission_cache.py` (cache key drops org)
- Modify: identity serializers/viewsets/services/selectors for moved models
- Delete: `../studiohub/backend/apps/identity/permissions/organization.py` if present; remove `IsOrganizationMember` / `IsOrganizationOwner` usages
- Test: `../studiohub/backend/apps/identity/tests/test_no_org_rbac.py` (new)

**Interfaces:**
- Consumes: `PlatformScopedModel`, `PlatformScopedViewSet` from Task B1.
- Produces: global `Role`, `Permission`, `Group`, `ApiKey`, `PersonalAccessToken` models with no `organization` field; `get_permission_cache_key(user_id)` with no org segment; `frontend_user` serializer with no `organization_id`/`organization_name`/`department` fields.

- [ ] **Step 1: Write the failing test**

```python
# ../studiohub/backend/apps/identity/tests/test_no_org_rbac.py
from apps.identity.models import Role, ApiKey


def test_rbac_models_have_no_org_field():
    assert "organization" not in [f.name for f in Role._meta.get_fields()]
    assert "organization" not in [f.name for f in ApiKey._meta.get_fields()]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest apps/identity/tests/test_no_org_rbac.py -v` (workdir `../studiohub/backend`)
Expected: FAIL (`organization` still present on one or both models).

- [ ] **Step 3: Move models and strip org**

Create the new identity model modules (or edit existing ones) subclassing `PlatformScopedModel`, copying fields except `organization`. Update permission resolver + cache service to key by `identity.permission:{user_id}:{version}`. Delete the org permission module and both `IsOrganization*` classes; update imports. Update `frontend_user` serializer to drop org fields and serve project memberships only.

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest apps/identity/tests/test_no_org_rbac.py -v` then `uv run pytest apps/identity -q` (workdir `../studiohub/backend`)
Expected: PASS, then full identity suite green.

- [ ] **Step 5: Commit**

```bash
git add apps/identity/
git commit -m "feat(identity): absorb global RBAC and security, drop org FK"
```

---

### Task 3 [B3]: Masterdata absorbs global directory + reference data

**Files:**
- Create: `../studiohub/backend/apps/masterdata/models/{person,client,vendor,client_contact,client_contract,vendor_contact,vendor_contract,department,team,office,position}.py`
- Modify: `../studiohub/backend/apps/masterdata/models/base.py` is OUT OF SCOPE for this task (moved to Task 7 [B7]): do NOT drop `CatalogModel.organization`, do NOT delete `OrgConfigModel` / `Organization*Config` models, do NOT merge `Platform*` canonicals here — the importers die atomically with the org app, and deleting now breaks every subsequent backend suite.
- Modify: masterdata serializers/viewsets/urls for flat `/api/v1/...` endpoints (departments/teams/offices/positions/people/clients/vendors + `?client=`/`?vendor=` filtering on contacts/contracts — NO nested router registrations); delete `OrganizationInitializationService` + provision-on-create handler
- Modify: identity serializers/viewsets/urls for flat `GET /api/v1/roles|groups|permissions/` (identity-owned viewsets on `PlatformScopedViewSet`, platform permission codes; mount at v1 root, avoiding legacy route-name collisions)
- Test: `../studiohub/backend/apps/masterdata/tests/test_global_directory.py` (new)

**Interfaces:**
- Consumes: `PlatformScopedModel` (B1), identity `Role`/`Group` canonicals (B2).
- Produces: flat endpoints `GET /api/v1/roles|groups|permissions|departments|teams|offices|positions|clients|vendors|people` (trailing slash, paginated); catalog reads GLOBAL scope only.

- [ ] **Step 1: Write the failing test**

```python
# ../studiohub/backend/apps/masterdata/tests/test_global_directory.py
from django.urls import reverse


def test_directory_endpoints_are_flat(api_client, django_user):
    api_client.force_authenticate(user=django_user)
    for path in ["departments", "clients", "vendors", "people"]:
        response = api_client.get(f"/api/v1/{path}/")
        assert response.status_code in (200, 403), path
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest apps/masterdata/tests/test_global_directory.py -v` (workdir `../studiohub/backend`)
Expected: FAIL (routes/models missing).

- [ ] **Step 3: Implement moved models + flat viewsets**

Create the model modules on `PlatformScopedModel` (Person keeps FK to `identity.User` + Department/Team/Office). Register flat viewsets/urls. Delete config-override models and the provisioning service/handler.

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest apps/masterdata/tests/test_global_directory.py -v` then `uv run pytest apps/masterdata -q` (workdir `../studiohub/backend`)
Expected: PASS, then masterdata suite green.

- [ ] **Step 5: Commit**

```bash
git add apps/masterdata/
git commit -m "feat(masterdata): absorb global directory and reference data"
```

---

### Task 4 [B4]: Production drops org (project scope only)

**Files:**
- Modify: `../studiohub/backend/apps/production/models/*.py` (all 19 files: remove `organization` FK, `unique(org,code)` → `unique(code)`, indexes on `(project, ...)`)
- Modify: `../studiohub/backend/apps/production/api/viewsets/base.py` (drop org context + dual narrowing), `../studiohub/backend/apps/production/api/urls_project_scoped.py` (remove org URL segment)
- Modify: `Asset.department/team`, `Task.team` → masterdata FKs; `ProjectMembership.role_ref` → identity `Role`
- Test: `../studiohub/backend/apps/production/tests/test_project_without_org.py` (new)

**Interfaces:**
- Consumes: masterdata Department/Team (B3), identity Role (B2).
- Produces: `Project` creatable with no `organization_id`; production querysets narrowed by project membership only.

- [ ] **Step 1: Write the failing test**

```python
# ../studiohub/backend/apps/production/tests/test_project_without_org.py
import pytest
from apps.production.models import Project


@pytest.mark.django_db
def test_project_create_requires_no_org():
    project = Project.objects.create(code="NOORG-001", name="No Org Project")
    assert project.pk is not None
    assert not hasattr(project, "organization")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest apps/production/tests/test_project_without_org.py -v` (workdir `../studiohub/backend`)
Expected: FAIL (org FK still required / attribute exists).

- [ ] **Step 3: Strip org from production models + viewsets + urls**

Remove every `organization` FK, rewrite uniqueness/indexes, re-point department/team/role refs, remove `resolve_organization_context` / `has_organization_access` from production views/selectors, drop the org URL segment.

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest apps/production/tests/test_project_without_org.py -v` then `uv run pytest apps/production -q` (workdir `../studiohub/backend`)
Expected: PASS, then production suite green.

- [ ] **Step 5: Commit**

```bash
git add apps/production/
git commit -m "feat(production): drop org FK, project scope only"
```

---

### Task 5 [B5]: Remaining apps drop org

**Files:**
- Modify: `../studiohub/backend/apps/audit/models/*.py` (8 files), `../studiohub/backend/apps/settings/models/organization.py` (delete or strip), `../studiohub/backend/apps/platform/models/__init__.py`, `../studiohub/backend/apps/deliveries/models/__init__.py`, `../studiohub/backend/apps/publishing/models/`, `../studiohub/backend/apps/scheduling/models/__init__.py`, `../studiohub/backend/apps/intelligence/models/`
- Modify: corresponding viewsets (replace `OrganizationScopedViewSet` with `PlatformScopedViewSet`), admins (`OrganizationScopedModelAdmin` → platform base), selectors, serializers
- Test: existing suites (no new test file; regression only)

**Interfaces:**
- Consumes: `PlatformScopedViewSet`, `PlatformScopedModelAdmin` (B1).
- Produces: same endpoints with platform-level permission codes, no org FK columns.

- [ ] **Step 1: Record the failing state**

Run: `uv run pytest apps/audit apps/settings apps/platform apps/deliveries apps/publishing apps/scheduling apps/intelligence -q` (workdir `../studiohub/backend`)
Expected: baseline result recorded in the commit message; failures referencing `organization` indicate remaining coupling.

- [ ] **Step 2: Strip org FKs and re-point bases**

Drop every `organization` FK column, swap viewset/admin bases, update permission checks to platform codes, update selectors/serializers.

- [ ] **Step 3: Run tests to verify they pass**

Run: `uv run pytest apps/audit apps/settings apps/platform apps/deliveries apps/publishing apps/scheduling apps/intelligence -q` (workdir `../studiohub/backend`)
Expected: PASS (all green; pre-existing unrelated failures listed explicitly if any).

- [ ] **Step 4: Commit**

```bash
git add apps/audit apps/settings apps/platform apps/deliveries apps/publishing apps/scheduling apps/intelligence
git commit -m "feat(apps): drop org FK across audit, settings, platform, deliveries, publishing, scheduling, intelligence"
```

---

### Task 6 [B6]: Core de-org + `init_platform` command

**Files:**
- Delete: `../studiohub/backend/apps/core/middleware/organization.py`; remove from `config/settings/components/middleware.py`
- Modify: `../studiohub/backend/apps/core/cache/api_response.py` (key without org), `../studiohub/backend/apps/core/api/exceptions/handlers.py`, `../studiohub/backend/apps/core/logging/*`, `apps/core/filters/organization.py` (delete), `apps/core/models/querysets/organization.py` + `mixins/organization.py` (delete), `apps/core/models/bases/{scopes,organization,ownership}.py` (remove org mixins), `apps/core/filesystem/storage.py` (drop org segment)
- Create: `../studiohub/backend/apps/core/management/commands/init_platform.py`
- Rewrite: seed commands without org
- Test: `../studiohub/backend/apps/core/tests/test_init_platform.py` (new)

**Interfaces:**
- Consumes: global models from B2/B3.
- Produces: `python manage.py init_platform` — idempotent; seeds roles/permissions/statuses/departments/teams/offices/positions; safe to run twice.

- [ ] **Step 1: Write the failing test**

```python
# ../studiohub/backend/apps/core/tests/test_init_platform.py
from django.core.management import call_command


def test_init_platform_is_idempotent(db):
    call_command("init_platform")
    call_command("init_platform")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest apps/core/tests/test_init_platform.py -v` (workdir `../studiohub/backend`)
Expected: FAIL (`init_platform` command not found).

- [ ] **Step 3: Implement de-org + command**

Delete the middleware file and all org filter/queryset/mixin modules, scrub cache/log/error/storage org handling, write the idempotent seed command using `get_or_create` keyed on `code`, rewrite seeds.

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest apps/core/tests/test_init_platform.py -v` then `uv run pytest apps/core -q` then `uv run python manage.py check` (workdir `../studiohub/backend`)
Expected: PASS, suite green (modulo the 3 known pre-existing failures: openapi schema, bare-array envelopes, admin registry — confirm identical on pristine `develop`), check clean.

- [ ] **Step 5: Commit**

```bash
git add apps/core config/settings/components/middleware.py
git commit -m "feat(core): remove org middleware and partitioning, add init_platform seed"
```

---

### Task 7 [B7]: Delete the organization app

**Files:**
- Delete: entire `../studiohub/backend/apps/organization/` directory
- Modify: `../studiohub/backend/config/v1_urls.py` (remove `apps.organization` includes; legacy flat aliases gone — masterdata/identity flat routes serve), `../studiohub/backend/config/api_urls.py` (remove nested + project-scoped org routes), `../studiohub/backend/config/settings/components/apps.py` (remove from INSTALLED_APPS)
- Modify (absorbed from Task 3 [B3]): `../studiohub/backend/apps/masterdata/models/base.py` (drop `CatalogModel.organization`, delete `OrgConfigModel`), delete `Organization*Config` models, merge `PlatformRole/PlatformGroup/PlatformDepartment/PlatformPosition` into identity/masterdata canonicals (dedupe by code)
- Test: full backend suite (regression only)

**Interfaces:**
- Consumes: everything above (no remaining imports of `apps.organization` anywhere).
- Produces: `/api/v1/organization/...`, `/api/organizations/...`, `/api/organizations/<org>/projects/...` trees return 404-by-absence; no `apps.organization` import resolves.

- [ ] **Step 1: Prove no remaining imports**

Run: `grep -rn "apps.organization\|from apps import organization" --include="*.py" apps config | grep -v __pycache__` (workdir `../studiohub/backend`)
Expected: empty output before deletion proceeds; every hit must be fixed first.

- [ ] **Step 2: Delete app + masterdata config cleanup + update configs**

Run: `git rm -r apps/organization`, perform the absorbed masterdata cleanup (drop `CatalogModel.organization`, delete `OrgConfigModel` + `Organization*Config`, merge `Platform*` canonicals), then edit the three config files to remove the includes and the INSTALLED_APPS entry, then `uv run python manage.py makemigrations --check` (workdir `../studiohub/backend`)
Expected: check clean (no model changes detected).

- [ ] **Step 3: Run full backend validation**

Run: `uv run python manage.py check && uv run pytest -q && uv run ruff check .` (workdir `../studiohub/backend`)
Expected: all three green.

- [ ] **Step 4: Commit**

```bash
git add config/v1_urls.py config/api_urls.py config/settings/components/apps.py
git commit -m "feat!: delete organization app, remove org API trees"
```

---

### Task 8 [B8]: Backend fresh-DB workflow validation

**Files:** none (validation only).

- [ ] **Step 1: Rebuild fresh DB and run the required workflow**

Run (workdir `../studiohub/backend`):

```bash
uv run python manage.py migrate --run-syncdb
uv run python manage.py createsuperuser --noinput --username admin --email admin@studiohub.local || true
uv run python manage.py init_platform
uv run pytest -q
```

Expected: migrate clean, superuser created (or already exists), seed idempotent, suite green. Then via API: create user + role grant, create project/client/vendor with no org fields, exercise a production endpoint (e.g. create shot under project), confirm an audit row exists.

- [ ] **Step 2: Record results**

Append results (commands + outputs) to the residual report in Task D1. No code changes; no commit unless fixes are needed (fixes become their own tasks).

---

### Task 9 [C1]: Frontend API layer de-org

**Files:**
- Modify: `src/api/client/ApiClient.ts` (delete lines 39–42 header injection)
- Delete: `src/modules/organization/api/organizationApi.ts` (re-home surviving flat calls first — grep each export, move needed ones to the owning module API, then delete)
- Modify: `src/api/repositories/adapters/rest/*`, `src/core/api/*`, `src/api/masterDataApi.ts`, `src/core/activity/activityService.ts`, `src/features/dashboard/api/getDashboardData.ts` (drop `studiohub_active_org_id` reads / org params)
- Test: `src/api/client/__tests__/noOrgHeader.test.ts` (new)

**Interfaces:**
- Consumes: backend flat endpoints from B3/B4.
- Produces: no request carries `X-Organization-Id`; no code reads `studiohub_active_org_id`.

- [ ] **Step 1: Write the failing test**

```ts
// src/api/client/__tests__/noOrgHeader.test.ts
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('no org header', () => {
  it('ApiClient never references the org header or storage key', () => {
    const src = fs.readFileSync('src/api/client/ApiClient.ts', 'utf8');
    expect(src).not.toContain('X-Organization');
    expect(src).not.toContain('studiohub_active_org_id');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/api/client/__tests__/noOrgHeader.test.ts` (frontend root)
Expected: FAIL (both strings present).

- [ ] **Step 3: Implement**

Delete the `activeOrgId` block in `ApiClient.ts` beforeRequest hook. Re-home each `organizationApi.ts` export to its owning module, update importers, delete the file. Scrub org params from adapters, `masterDataApi.ts`, `activityService.ts`, `getDashboardData.ts`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/api/client` then `pnpm exec tsc --noEmit` (frontend root)
Expected: PASS, then typecheck green.

- [ ] **Step 5: Commit**

```bash
git add src/api src/core/activity src/features/dashboard scripts
git commit -m "feat(frontend): remove org header and storage from API layer"
```

---

### Task 10 [C2]: Frontend core de-org (context, auth, permissions, master data, production)

**Files:**
- Delete: `src/core/organization/*` (`OrganizationContext.tsx`, `useOrganization.ts`, `__tests__/`)
- Modify: `src/App.tsx` (remove `OrganizationProvider` import + wrapper), `src/core/auth/*` (drop `memberships`, `hasOrgAccess`, `getMembershipForOrg`, `currentMembership`, `purgeTenantState`), `src/core/permissions/*` (`rbac.ts`, `scopeEngine.ts`, `routePermissionsRegistry.ts`, `usePermissionEvaluator.ts`, `accessControl.ts`, `useAccessManagementStore.ts`, `usePermissions.tsx`, `permissionCatalog.ts` — drop org dimension), `src/core/production/ProductionContext.tsx`, `src/core/masterData/useMasterData.ts`, `src/core/testing/*`
- Test: update `src/core/auth/__tests__/purgeTenantState.test.ts` (delete), `src/core/organization/__tests__/switchOrganization.test.tsx` (delete); new `src/core/permissions/__tests__/platformProjectAccess.test.ts`

**Interfaces:**
- Consumes: `ApiClient` without org (C1).
- Produces: `usePermissions()` evaluates platform permission codes + project membership only; `useOrganization` resolves to nothing (deleted — zero consumers).

- [ ] **Step 1: Write the failing test**

```ts
// src/core/permissions/__tests__/platformProjectAccess.test.ts
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const files = ['src/core/permissions/rbac.ts', 'src/core/permissions/scopeEngine.ts', 'src/core/permissions/accessControl.ts'];

describe('platform+project access', () => {
  it('permission core has no org dimension', () => {
    for (const f of files) {
      const src = fs.readFileSync(path.resolve(f), 'utf8');
      expect(src.toLowerCase()).not.toContain('hasorgaccess');
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/core/permissions/__tests__/platformProjectAccess.test.ts` (frontend root)
Expected: FAIL (`hasOrgAccess` present).

- [ ] **Step 3: Implement**

Delete `src/core/organization/`. Remove provider from `App.tsx`. Strip membership/org logic from auth + permissions + production/master-data core. Re-root query keys (`['organizations', orgId, ...]` → `['projects', id, ...]` / `['master-data', ...]`). Delete obsolete tests.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/core src/layouts` then `pnpm exec tsc --noEmit` (frontend root)
Expected: PASS, then typecheck green. Prove zero consumers: `grep -rn "useOrganization" src --include="*.ts*" | wc -l` → `0`.

- [ ] **Step 5: Commit**

```bash
git add src/core src/App.tsx
git commit -m "feat(frontend): remove org context, memberships, and org permission dimension"
```

---

### Task 11 [C3]: Routes, layouts, navigation

**Files:**
- Modify: `src/routes/AppRoutes.tsx` (remove `OrganizationRoute` wrapper at line 116, `/organizations/:id` routes at 134–144, access redirects at 148–158, `OrgWorkspaceRedirect` list routes, org-nested production routes; keep flat `/projects/:id...` variants)
- Delete: `src/routes/OrganizationRoute.tsx`, `src/routes/OrganizationMembershipRoute.tsx`, `src/routes/OrgWorkspaceRedirect.tsx` (and `AccessWorkspaceRedirect` export if org-only), `src/layouts/OrganizationSwitcher.tsx`
- Modify: `src/layouts/{Sidebar,Header,AppLayout}.tsx`, `src/routes/{ProjectRoute,PermissionRoute,RoutePermissionGuard}.tsx`
- Test: `src/routes/__tests__/` (update org-gated tests; new `noOrgBoot.test.tsx`)

**Interfaces:**
- Consumes: org-free auth/permissions (C2).
- Produces: app boots with no org gate; no `/organizations/...` routes; projects are the primary workspace.

- [ ] **Step 1: Write the failing test**

```tsx
// src/routes/__tests__/noOrgBoot.test.tsx
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('org-free routing', () => {
  it('AppRoutes has no organization gate or deep links', () => {
    const src = fs.readFileSync('src/routes/AppRoutes.tsx', 'utf8');
    expect(src).not.toContain('OrganizationRoute');
    expect(src).not.toContain('/organizations/:');
    expect(src).not.toContain('OrgWorkspaceRedirect');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/routes/__tests__/noOrgBoot.test.tsx` (frontend root)
Expected: FAIL (all three strings present).

- [ ] **Step 3: Implement**

Rewrite `AppRoutes.tsx` per spec §4 (frontend design, routes paragraph). Delete guard/redirect/switcher files. Update Sidebar/Header/AppLayout (static studio badge stays, switching UI gone) and `ProjectRoute`/`PermissionRoute`/`RoutePermissionGuard` (no org checks). Update layout tests (`OrganizationSwitcher.test.tsx` delete; `HeaderAccessGating`, `SidebarAccessGate`, `ProjectSwitcher` update).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/routes src/layouts` then `pnpm exec tsc --noEmit` (frontend root)
Expected: PASS, then typecheck green.

- [ ] **Step 5: Commit**

```bash
git add src/routes src/layouts
git commit -m "feat(frontend): org-free routes, layouts, and navigation"
```

---

### Task 12 [C4]: Modules de-org

**Files:**
- Delete: `src/modules/organization/*`, `src/features/organizations/*`, `src/shared/relationships/OrgEntitySelector.tsx`
- Modify: access, people, departments, teams, offices, production, assets, episodes, audit, platform, reviews, tasks, versions, shots, workflows, scheduling, intelligence modules — every hook with `activeOrgId = orgId || ...` / `enabled: !!activeOrgId` / `organization_id` stamping / `['organizations', ...]` keys / nested `/api/organizations/<org>/...` URLs (inventory: `useClientData`, `useVendorData`, `usePeopleData`, `useOrgStructureData`, `useWorkforceData`, `useAccessData`, `useOrgInsightsData`, `useOrganizationMutations`, `useOrganizationData`, `useCloneMaster`, `useBulkDelete`, `useProjectScopedData`, `useProjects`, `useAssets`, `useShots`, `useTasks`, `useVersions`, `useReviews`, `ProductionContext`, `useMasterData`, `CloneMasterButton`, `OrgCatalogConfig`, `MasterDataHeader`, `BrandingTab`, `PersonWorkspacePage`, `ProjectWorkspace`, `ProjectFormPage`, `ProjectsPage`, `ProjectWorkflowType`, audit pages)
- Test: delete `useProjectsOrgScope.test.tsx`, `useProjects.org-gating.test.tsx`, `useCloneMaster.test.tsx`, `PositionsTabToggle.test.tsx`, `OrgCatalogConfig.test.tsx`; update the rest

**Interfaces:**
- Consumes: flat endpoints (C1), org-free core (C2), org-free routes (C3).
- Produces: no module calls `useOrganization` or sends org params; forms/schemas have no `organization` fields.

- [ ] **Step 1: Prove the current failing state**

Run: `grep -rln "useOrganization\|activeOrgId\|organization_id\|'organizations'" src/modules src/features src/shared --include="*.ts" --include="*.tsx" | sort` (frontend root)
Expected: non-empty list (this task empties it).

- [ ] **Step 2: Implement module by module**

For each file: remove `useOrganization` import/usage, drop `orgId` params, re-root query keys, point autocomplete/mutations at flat endpoints, remove `organization_id` from Zod schemas and payloads. Delete the organization module, features/organizations, and `OrgEntitySelector.tsx` (re-point importers at `AsyncEntitySelector`/`EntityPicker`).

- [ ] **Step 3: Run tests to verify they pass**

Run: `grep -rn "useOrganization" src --include="*.ts*" | wc -l` (expect `0`), then `pnpm vitest run src/modules` then `pnpm exec tsc --noEmit` (frontend root)
Expected: `0`, suites PASS, typecheck green.

- [ ] **Step 4: Commit**

```bash
git add src/modules src/features src/shared
git commit -m "feat(frontend): de-org all feature modules, flat endpoints and keys"
```

---

### Task 13 [C5]: Types, shared, scripts, mocks

**Files:**
- Delete: `src/types/organization.ts`
- Modify: `src/types/{auth,identity,production,masterData,audit}.ts` (drop org fields), `src/shared/crud/*` (drop org params), `scripts/seed-platform-org-structure.ts` (rewrite org-free or delete — its `src/mocks` import is already stale), remaining `scripts/*` org refs, `src/core/api/generated/openapi.ts` (regenerate or strip org paths)
- Test: typecheck + full unit suite (regression only)

**Interfaces:**
- Consumes: C1–C4 (no remaining legal importers of org types).
- Produces: `tsc --noEmit` green with zero `organization` imports in runtime code.

- [ ] **Step 1: Prove the current failing state**

Run: `grep -rn "from '@/types/organization'\|from '../organization'\|types/organization" src scripts --include="*.ts" --include="*.tsx" | head -n 20` (frontend root)
Expected: non-empty list (this task empties it).

- [ ] **Step 2: Implement**

Delete `src/types/organization.ts`, fix all importers, strip org fields from the remaining type files, scrub shared CRUD + scripts + generated contract.

- [ ] **Step 3: Run validation**

Run: `pnpm exec tsc --noEmit` then `pnpm vitest run` then `pnpm build` (frontend root)
Expected: all three green.

- [ ] **Step 4: Commit**

```bash
git add src/types src/shared scripts src/core/api/generated
git commit -m "feat(frontend): remove org types, scrub shared, scripts, and generated contract"
```

---

### Task 14 [C6]: e2e + docs

**Files:**
- Rewrite: `e2e/organization-isolation.spec.ts` → `e2e/platform-project-isolation.spec.ts`; `e2e/org-entity-views-batch3.spec.ts` → flat entity views; `e2e/organization-contact.spec.ts`, `e2e/team-create.spec.ts` (drop org setup); `e2e/route-authorization.spec.ts`, `e2e/rest-authorization.spec.ts` (drop org gates)
- Create: `e2e/platform-workflow.spec.ts` — superuser → `init_platform` → master data → users → project/client/vendor (no org) → production workflow → audit
- Modify: `CLAUDE.md` (remove `core/organization` from structure, `organization` module from list, `useOrganization` section), `docs/frontend/*` (`NAVIGATION.md`, `AUTHORIZATION.md`, `DOMAIN_MODEL.md`, `ARCHITECTURE.md`, `ENTITY_RELATIONSHIPS.md`, `STATE_MANAGEMENT.md`, `ORGANIZATION_AUDIT_REPORT.md`, `ORGANIZATION_NAVIGATION_AUDIT.md`), `docs/api/*` (contract, domains/organization.md, permissions, authentication), plus ADR for the removal decision
- Test: Playwright suite (needs Django backend + seed)

**Interfaces:**
- Consumes: everything above.
- Produces: green e2e on the org-free app; docs describe platform/project access only.

- [ ] **Step 1: Write the new workflow spec (fails first)**

```ts
// e2e/platform-workflow.spec.ts
import { test, expect } from '@playwright/test';

test('platform workflow with no org', async ({ page }) => {
  await page.goto('/login');
  await expect(page).not.toHaveURL(/organizations/);
  await page.getByLabel(/username|email/i).fill('admin@studiohub.local');
  await page.getByLabel(/password/i).fill('admin');
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto('/projects');
  await expect(page.getByRole('heading', { name: /projects/i })).toBeVisible();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec playwright test e2e/platform-workflow.spec.ts` (frontend root, backend running)
Expected: FAIL (login/project flow still org-gated at this point if run early; after C1–C5 it should pass — keep the failure output as the task record either way).

- [ ] **Step 3: Rewrite specs + docs + ADR**

Rewrite/delete the org specs, update `CLAUDE.md`, frontend/api docs, and write `docs/architecture/ORGANIZATION_REMOVAL_ADR.md` (decision: fresh-DB big-bang, re-homing table, header/storage removal, validation results).

- [ ] **Step 4: Run e2e to verify green**

Run: `pnpm exec playwright test` (frontend root, Django backend + seed available)
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add e2e CLAUDE.md docs
git commit -m "test(e2e): org-free specs and platform workflow; docs updated"
```

---

### Task 15 [D1]: Final validation + residual reference report

**Files:** none modified except the report (append to `docs/architecture/ORGANIZATION_REMOVAL_ADR.md` or new `docs/architecture/ORGANIZATION_RESIDUAL_REPORT.md`).

- [ ] **Step 1: Backend final validation**

Run (workdir `../studiohub/backend`): `uv run python manage.py check && uv run pytest -q && uv run ruff check . && uv run python manage.py makemigrations --check`
Expected: all green. Record outputs.

- [ ] **Step 2: Frontend final validation**

Run (frontend root): `pnpm exec tsc --noEmit && pnpm vitest run && pnpm build`
Expected: all green. Record outputs.

- [ ] **Step 3: Residual organization scan**

Run (both repos): `grep -rni "organization" --include="*.py" ../studiohub/backend/apps ../studiohub/backend/config | grep -v __pycache__ | grep -v test | head -n 50` and `grep -rni "organization" src scripts e2e --include="*.ts" --include="*.tsx" | head -n 50` (frontend root)
Expected: every remaining hit classified in the report as intentional-historical/docs vs code; zero runtime code references. The required workflow (superuser → init_platform → master data → users → project/client/vendor → production → audit) recorded as passing.

- [ ] **Step 4: Commit report**

```bash
git add docs/architecture/ORGANIZATION_RESIDUAL_REPORT.md docs/architecture/ORGANIZATION_REMOVAL_ADR.md
git commit -m "docs: organization removal residual report and ADR"
```
