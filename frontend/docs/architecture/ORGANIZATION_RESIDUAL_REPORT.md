# Residual Organization Reference Report

- **Date**: 2026-10-19
- **Task**: 15 [D1] — final validation + residual reference report
- **Branch**: `chore/org-removal` (frontend + backend worktrees)
- **Scope**: every remaining `organization` string in the de-orged codebases,
  classified as **intentional-historical/docs** vs **code**.

## Summary

The organization tenant layer is removed. Every remaining `organization`
string in both repositories is either (a) the surviving RBAC/audit **vocabulary**
(`Scope 'ORGANIZATION'`, `RoleCategory 'organization'`, audit `target_type
"organization"`), (b) a **vestigial compat surface** (project-scoped routes
served under the `/api/organizations/projects/...` prefix; accepted-and-ignored
`organization=` kwargs; the `/billing` route), (c) **documentation / historical
records** (migrations, docs, docstrings, ADR), or (d) **dead code** (unrouted
pages, zero-dispatch event dataclasses, seed paths to deleted frontend mocks).

**Zero runtime references to the removed Organization entity remain.**

## Final validation gates

### Backend (`backend/`, workdir `studiohub/.worktrees/org-removal/backend`, `DJANGO_ENV=testing`)

| Gate | Command | Result |
|---|---|---|
| System check | `uv run python manage.py check` | ✅ exit 0 — "System check identified no issues" |
| Lint | `uv run ruff check .` | ✅ exit 0 — "All checks passed!" |
| Migrations | `uv run python manage.py makemigrations --check --dry-run` | ✅ exit 0 — "No changes detected" |
| Test suite | `uv run pytest -q` | ⚠️ **1 failed, 1609 passed, 1 skipped** (583.89s; coverage 77.32% ≥ 72%) |

The single failure is `apps/core/tests/admin/test_admin_registry.py::TestAdminRegistryDiscovery::test_all_concrete_models_registered`
(identity RBAC models never admin-registered). **Pre-existing, not task-caused**
(controller confirmation 5; reproduced on the pre-plan base commit in Task 8,
and the plan's own commit `0b85370` documents it as a known core failure).

### Frontend (`studiohub-react/.worktrees/org-removal`)

| Gate | Command | Result |
|---|---|---|
| Typecheck | `pnpm exec tsc --noEmit` | ✅ exit 0 |
| Unit tests | `pnpm vitest run` | ✅ 46 files / 166 tests passed |
| Build | `pnpm build` | ✅ exit 0 (vite build + `dist/server.cjs`) |
| Contract regenerate | `DJANGO_SCHEMA_URL=http://127.0.0.1:8000/api/schema/ pnpm api:generate --fetch` | ✅ exit 0 |
| Contract validate | `pnpm api:validate` | ❌ **pre-existing failure** — `src/mocks/handlers` dir removed at commit `5436419` (ancestor of HEAD); script is stale, unrelated to this task |

### E2E — re-run this session after the contract regeneration

`E2E_EXTERNAL_SERVER=1 pnpm exec playwright test --workers=3` against the fresh
production build (`node dist/server.cjs`) + live backend: **49 passed (2.0m), 0
failed, 0 skipped** — identical to the Task 14 record, now on the regenerated
contract. Seed fixtures + flat endpoints re-verified live this session (see
below); no spec changes were needed.

## Seed fixtures + backend flat endpoints (controller confirmation 3) — re-verified live

Live de-orged backend reachable at `127.0.0.1:8000` (same process Task 14 used).

| Endpoint | Result |
|---|---|
| `POST /api/v1/auth/login/` (`admin@studiohub.local` / `admin123`) | ✅ 200, tokens issued |
| `GET /api/v1/auth/me/` | ✅ superuser, `Platform Admin`, **68 permissions** |
| `GET /api/v1/roles/` | ✅ count 7, paginated |
| `GET /api/v1/groups/` | ✅ count 0, paginated |
| `GET /api/v1/departments/` | ✅ count 8, paginated |
| `GET /api/v1/positions/` | ✅ count 4, paginated |
| `GET /api/v1/teams/` | ✅ count 8, paginated |
| `GET /api/v1/offices/` | ✅ count 2, paginated |
| `GET /api/v1/platform/master-data/statuses` | ✅ 200 |
| `GET /api/v1/clients/` | ✅ count 27 |
| `GET /api/v1/vendors/` | ✅ count 11 |
| `GET /api/v1/projects/` | ✅ count 2 |
| `GET /api/v1/identity/users/` | ✅ 6 users incl. `admin@studiohub.local` |
| `GET /api/v1/permissions/` | ✅ 68 perms (catalog) |

Workflow recorded passing (Task 14 e2e + Task 8 API chain, re-confirmed live):
**superuser → `init_platform` → master data → users → project/client/vendor
(no org) → production → audit**.

## Shared test DB constraint (controller confirmation 4) — recorded

- `SELECT rolcreatedb FROM pg_roles WHERE rolname='studio'` → **f**
- `createdb studiohub_test_probe` → `ERROR: permission denied to create database`
- Shared DB `studiohub` (192.168.1.109:5439) still carries **31
  `%organization%` tables** (org-era drift). Migrating it fails on the
  `deliveries_package_client_id_ab24337f` index collision (recorded Task 8).
- **Constraint**: a user with `CREATEDB` must drop and recreate the shared test
  DB from the fresh migration graph before `manage.py migrate` works there.
  Pytest still passes because the custom `PreserveDatabaseTestRunner` runs
  in-place against the existing (drifted) schema.

## Generated contract — regenerated from the de-orged backend (controller confirmation 1)

Task 13 had deferred ~485 field-level `organization_id|organization|organization_name`
refs in `src/core/api/generated/openapi.ts` + yml (pre-removal artifact). The
de-orged backend was reachable, so this task **regenerated the contract**:

| Metric | Before (committed) | After (regenerated) |
|---|---|---|
| `organization_id` field refs in `openapi.ts` | 41 | **0** |
| `organization_name` field refs | 18 | **0** |
| `OrganizationBilling`/`PatchedOrganizationBillingUpdate` schemas | present (9 refs) | **0** (backing endpoint deleted with org app) |
| org paths in contract | 0 (stripped) | 34 — all **real** vestigial `/api/organizations/projects/{project_id}/...` routes the de-orged backend serves and `projectScopedApi.ts` calls |
| `openapi.ts` size | 47,496 lines | 43,552 lines |
| schema file | `django-openapi.yml` (stripped, 56,581 lines / ~1.58 MB) | `django-openapi.yml` (live fetch, 48,837 lines / 1.4 MB) |

- Schema fetched from the live backend; `.json`→`.yml` normalized to repo
  convention (the fetch content-type sniff produced a YAML-bodied `.json`).
- `pnpm api:generate` (no-fetch) reproduces the identical `openapi.ts` from the
  committed yml.
- `tsc`, `vitest`, and `build` all re-ran green on the regenerated contract.
- The 34 org paths are classified **intentional-historical/vestigial**: the
  backend URLconf documents them ("prefix is vestigial from the org
  architecture… carries no org segment or org scoping", `config/api_urls.py`),
  the frontend actually calls them, and they 404 only when no real project id
  resolves.

## Residual scan — backend (`backend/apps` + `backend/config`, `*.py`)

`grep -rni "organization" --include="*.py" apps config | grep -v __pycache__`

| Bucket | Lines | Classification |
|---|---|---|
| Migrations (history) | 314 | intentional-historical |
| Runtime (non-migration, non-test) | 278 | see breakdown below |
| Tests | 73 | intentional (org-free assertions / RBAC fixtures) |
| **Total** | **665** | — |

### Runtime breakdown (278 lines) — all intentional

| Class | Representative files | Notes |
|---|---|---|
| **RBAC vocabulary** | `identity/choices/rbac.py`, `identity/api_keys/scopes.py`, `identity/models/role.py`, `core/constants/__init__.py` (`VISIBILITY_ORGANIZATION`, `ORGANIZATION_TYPE_*`), `audit/constants/targets.py`, `audit/models/audit_log.py`, `core/management/commands/init_platform.py` (role seeds) | Surviving permission dimension, not the removed entity. |
| **Vestigial URL prefix** | `config/api_urls.py`, `apps/production/api/urls_project_scoped.py`, `apps/production/api/views/project_scoped.py` | Documented vestigial `/api/organizations/projects/...` mount; no org segment. |
| **Accepted-and-ignored kwargs** | `scheduling/selectors/capacity.py`, `scheduling/services/capacity.py`, `identity/services/authentication.py`, `identity/authentication/token.py`, `identity/services/login_history.py` (+ `audit/models/login_history.py` manager absorbs it), `identity/resolvers/permission.py`, `masterdata/services/resolution.py` | Public signatures keep `organization=None` for compatibility; value dropped. |
| **Dead compat code** | `core/api/mixins/bulk.py` `_organization()` (overridden to `None` by `ProductionEntityViewSet._organization()`), `core/events/{base,attachment,tag}.py` `organization_uuid` dataclass fields (zero dispatch sites), `core/services/mixins/soft_delete.py` `get_archived(organization=...)`, `core/api/utils/request.py` `get_organization` (no callers), `core/api/exceptions/permissions.py` `OrganizationPermissionException` (exported, never raised), `core/permissions/{tag,attachment}.py` `hasattr(obj, "organization")` guards (always False) | Dead or no-op after removal; kept to avoid churn, safe. |
| **Docstrings/comments** | `production/selectors/*`, `production/models/*`, `masterdata/models/*`, `audit/api/viewsets/activity.py`, `identity/models/*`, `intelligence/api/viewsets/search.py` (`"organizations": []` facet), `identity/api/viewsets/user.py`, `analytics.py`, `core/api/deprecations.py` | Documentation of the removed architecture. |
| **Seed paths to deleted frontend mocks** | `seed_dev.py`, `seed_studiohub.py` (`frontend_root / "organization" / "organization.ts"`) | Unreachable: `_resolve_mock_root()` raises `CommandError` (mock dataset removed) before these paths are read. Dev-only seeds. |
| **CORS header allowlist** | `config/settings/components/cors.py` (`x-organization-id`, `x-organization`) | Harmless allowlist; frontend no longer sends these headers. |
| **Fail-closed guard** | `audit/api/viewsets/activity.py` (`organization_id` kwarg → `Http404`) | Old nested-route guard; intentional. |

## Residual scan — frontend (`src` + `scripts` + `e2e`, `*.ts`/`*.tsx`/`*.cjs`/`*.mjs`)

| Bucket | Lines | Classification |
|---|---|---|
| Generated contract (`openapi.ts` + `django-openapi.yml`) | 434 + 494 (34 org paths, 0 org fields) | intentional-historical/vestigial (see above) |
| Non-generated `src` (non-test) | 219 | see breakdown below |
| `src` tests | 43 | intentional (org-free assertions / RBAC fixtures) |
| `e2e/` | 18 | intentional — all **negative assertions** (`not.toHaveURL(/organizations/)`) |
| `docs/` | 1,565 | intentional-historical |

Count scope notes (verified 2026-10-19):

- `openapi.ts` = **434** via case-insensitive `grep -cni organization
  src/core/api/generated/openapi.ts` (the earlier figure 373 was the
  case-sensitive `grep -c organization`). `django-openapi.yml` = 494 via
  `grep -cni organization src/core/api/generated/schema/django-openapi.yml`.
- "0 org fields" refers to **schema properties named `organization_id` /
  `organization_name`** (41 + 18 pre-regeneration → 0 after). The committed yml
  still contains **60** `organization_id` strings inside backend-emitted
  `x-deprecated-replacement: /api/organizations/{organization_id}/<resource>/`
  annotations (from `core/api/deprecations.py`) — documentation strings, not
  schema fields.
- `docs/` bucket = `grep -rni organization docs/` over **all tracked files,
  any extension** (includes this report). Exact count is **1,565** on the
  committed tree; of those, **1,438** fall in `*.md` files
  (`grep -rni organization docs/ --include="*.md"`). A figure of 1,519 was
  printed in the draft from a partial scan taken before this report was added
  to `docs/architecture/`.

### Non-generated `src` breakdown (219 lines) — all intentional

| Class | Representative files | Notes |
|---|---|---|
| **RBAC vocabulary** | `core/permissions/systemRoles.ts` (org role templates/codes), `core/permissions/scopeEngine.ts` (ORG scope → unconditional, documented), `core/permissions/can.ts` (`organizationId?` param, inert), `core/access/domainPermissions.ts` ("client organization" prose), `core/permissions/externalAccessEngine.ts` (client-isolation reasons), `types/identity.ts` (`Scope 'ORGANIZATION'`, `'organization'` unions) | Surviving permission dimension (matches backend). |
| **QA engine fixtures** | `core/testing/TestRunnerEngine.ts` (61) — `organization_id: 'org-apex-01'` writes | Typechecked via `[key: string]: any` index signatures; QA-only runtime. |
| **In-memory org-shaped fields** | `core/activity/activityService.ts` (`organizationId` on records + invalidate key), `core/production/ProductionContext.tsx` (`organization_id: ''`), `features/dashboard/api/getDashboardData.ts` (`_organizationId` inert param) | Surviving shape on in-memory/context data; no wire usage. |
| **User-facing prose** | `auth/demoUserUtils.ts` (`user.organization_name` fallbacks), `modules/settings/components/LayoutSettingsSection.tsx`, `core/layout/usePageLayoutStore.ts`, `pages/testing/TestCoverageDashboard.tsx`, `pages/TestingPage.tsx` (prose + `<option value="Organization">`), `modules/platform/components/*`, `modules/reviews/.../ReviewOverviewTab.tsx`, `shared/crud/fieldSchemas.ts` (`'Client Organization'` label — client entity), `modules/platform/admin/masterData/OrgStructure/GroupsSection.tsx` | Cosmetic strings, not references to the removed entity. |
| **Dead pages** | `modules/settings/pages/SettingsPage.tsx`, `modules/settings/pages/RolesSecurityPage.tsx` (navigate to `/organizations/org-apex`) | **Not routed** (AppRoutes redirects `/settings*`); dead code with a stale nav target. |
| **Test-only mount** | `modules/access/components/UserAccessSection.tsx` (`effectiveAccess.organizationMembership.role`) | Mounted only by `InspectorGating.test.tsx` which supplies the field; the `/access` route redirects to `/platform/admin/roles`. |
| **Relocation comments** | `types/{production,masterData,common,audit}.ts` (`// from organization.ts (relocated, org-free)`) | Docs. |
| **Vestigial URL prefix** | `modules/production/api/projectScopedApi.ts` (`/api/organizations/projects/${projectId}`) | Real route; backend serves it; no org semantics. |

## Fixes applied in this task

1. **Regenerated the OpenAPI contract** (`openapi.ts` + `schema/django-openapi.yml`)
   from the live de-orged backend — removes all stale field-level org refs and
   the `OrganizationBilling` schemas (controller confirmation 1).
2. **Updated `ORGANIZATION_REMOVAL_ADR.md`** — Task 15 final-gate results and
   re-classified residual items (the deferred contract refs are now resolved).

No other source changes were needed: `EntityRef.tsx` still uses its `Building2`
import (controller confirmation 2 — `case 'office': return Building2;`), so no
cleanup was required there.

## Substantive findings (reported, not fixed in-place)

1. **`/billing` route is inert** — `BillingPage` calls `/api/v1/billing/`,
   which lived only in the deleted org app's legacy tree (`404` on the de-orged
   backend). The route is fail-closed because `billing.view` / `page.billing`
   were never in the backend permission catalog (68 perms checked). Re-home the
   billing endpoint or remove the page/route/sidebar entry as a follow-up.
2. **`pnpm api:validate` is stale** — it requires `src/mocks/handlers`, removed
   at `5436419` (ancestor of HEAD). Pre-existing; update or retire the script.
3. **Dead pages with org nav** — `SettingsPage`/`RolesSecurityPage` (unrouted)
   still navigate to `/organizations/org-apex`. Harmless today (unreachable);
   delete or repoint when the settings pages are re-homed.
4. **`systemRoles.ts` org-era templates** remain (backend has no such roles) —
   catalog cleanup is a documented follow-up, not a regression.
5. **Shared test DB drift** — see the CREATEDB constraint above; requires a
   CREATEDB user to recreate before `migrate` works on shared state.

## Self-review

- Every gate above was actually run in this session with the recorded result;
  the two non-green items (`pytest` admin-registry, `api:validate`) are both
  proven pre-existing (reproduced on earlier commits / documented in the plan).
- Every residual classification is grounded in the greps above (paths + counts)
  and spot-checked against the source.
- The regenerated contract was re-gated (`tsc`/`vitest`/`build`) after the
  change; no source behavior was altered.
