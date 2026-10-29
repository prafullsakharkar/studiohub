# ADR: Remove the Organization Tenant Layer

- **Status**: Accepted (implemented)
- **Date**: 2026-10-19
- **Scope**: Backend `apps.organization` + frontend `core/organization` /
  `modules/organization` + the org-scoped e2e suite

## Context

StudioHub shipped with an organization tenant layer: an `Organization` root
entity, org-scoped querysets (`X-Organization-Id` header + `TenantMiddleware`),
an org context/switcher in the frontend, org workspace tabs, and org-scoped
RBAC codes. Production reality is a single studio: the tenant layer added
cross-cutting complexity (tenant middleware, org-scoped cache keys, switcher
state, org-parameterized API calls) without a second tenant to justify it.

## Decision

Remove the organization layer outright — a **fresh-DB big-bang removal**, not a
gradual dual-write migration:

1. Delete `apps.organization` (backend) and `core/organization` /
   `modules/organization` (frontend), including `useOrganization`,
   `OrganizationContext`, the org switcher, `/organizations/*` routes, org
   workspace tabs, and org-scoped RBAC codes/grants.
2. Re-home the directory entities as org-free platform entities (see
   re-homing table).
3. Remove the tenant header/storage contract: no `X-Organization-Id`, no
   `organization_id` in payloads, no org query parameters, no
   `/api/v1/users/me/memberships/` call.
4. Enforce isolation by **project membership** on both the API (DRF
   permission classes) and the frontend (route permission registry →
   `/forbidden`), with platform-admin bypass.

### Why fresh-DB big-bang

- No live traffic depends on the org layer (worktrees only); there is no
  upgrade path to preserve.
- The shared PostgreSQL test database is drifted org-era; a fresh database
  (`migrate` from zero) is the only supported path. Migration-history surgery
  (26 modified + 37 deleted migration files, 68 org FK → `IntegerField`
  conversions) was required so a clean graph exists with the org app deleted;
  final schema verified identical on a fresh SQLite migrate (92 nodes, zero
  org tables/columns).
- Forward-only schema changes; `makemigrations --check` enforced.

## Re-homing table

| Former org entity | New home | Notes |
| :--- | :--- | :--- |
| `Organization` | removed | no `/api/v1/organizations/` |
| `Client` / `Vendor` / `Person` / `Department` / `Team` / `Office` | `apps.masterdata` (backend), flat pages `/clients` `/vendors` `/people` `/departments` `/teams` `/offices` (frontend) | platform-wide, org-free |
| Roles, Groups, Permissions | `apps.identity` | flat `/api/v1/roles/`, `/api/v1/groups/`, `/api/v1/permissions/` (paginated `{count, results}`) |
| Production scoping | project membership | `IsProjectMember` + route guard |
| Org workspace tabs (People/Departments/Teams/Offices/Clients/Vendors/Access) | flat directory pages | standalone routes are canonical again |
| `organization.*` / `org.access/*` / invitation / API-key / token permissions | removed | tenant-specific codes deleted with the module |

## Header & storage removal

- `X-Organization-Id` header: removed from the contract
  (`docs/api/api-contract.md` §1.2, `docs/api/authentication.md` §1.2).
- Frontend request paths: no `organization_id` body field, no org query
  params; query keys are re-rooted org-free (`docs/frontend/STATE_MANAGEMENT.md`).
- Frontend auth: `RESTAuthAdapter.withMemberships` (the
  `/api/v1/users/me/memberships/` call) removed.
- Legacy redirects into org workspaces (`/people` → `/organizations/:id?tab=…`
  etc.) removed; `/access[/:section]` redirects to `/platform/admin/roles`.

## Consequences

- Directory entities are platform-wide; production data is isolated by
  project membership only. Non-members get a denial page (frontend) and `403`
  (API) with no data leak.
- The frontend route permission registry mirrors the backend membership
  check; both use the same underlying project-membership predicate.
- E2E assertions guarantee no `/organizations/` URL is ever reachable.

## Validation results

- Backend fresh-DB chain: 14/14 API steps green on scratch SQLite
  (Task 8 [B8]); `pytest` 1609 passed / 1 pre-existing admin-registry gap.
- Frontend `tsc --noEmit`: clean; `pnpm vitest run`: green.
- E2E (Playwright, live Django backend + seed, production build):
  **49/49 passed**, including:
  - `platform-workflow` (superuser → `init_platform` → master data → users →
    project/client/vendor (no org) → production workflow → audit)
  - `platform-project-isolation` (member opens project; non-member denied
    fail-closed; unknown id never crashes; superuser opens any project; no org
    URL reachable)
  - `route-authorization` / `rest-authorization` (org-free gates)
  - `flat-entity-views`, `client-vendor-contact`, `team-create`,
    `consolidation`, `real-api-validation` (live backend, no mock traffic)
- **Task 15 [D1] final gates (2026-10-19):** backend `manage.py check`, `ruff
  check`, `makemigrations --check` all green; `pytest` re-ran at **1609 passed /
  1 pre-existing admin-registry gap / 1 skipped** (identical to Task 8).
  Frontend `tsc --noEmit`, `vitest` (46 files / 166 tests), and `build` all
  green — including after regenerating the OpenAPI contract from the live
  de-orged backend. Seed fixtures + flat endpoints re-verified live
  (roles/groups/departments/positions/teams/offices paginate;
  `admin@studiohub.local` superuser with the full 68-permission catalog).

## Residual items

**Resolved by Task 15 [D1] (see `ORGANIZATION_RESIDUAL_REPORT.md`):**

- The generated contract (`openapi.ts` + `schema/django-openapi.yml`) was
  regenerated from the de-orged backend via `pnpm api:generate --fetch` on
  2026-10-19. All stale field-level `organization_id`/`organization_name`
  references (41 + 18 in `openapi.ts`) are gone, and the pre-removal
  `OrganizationBilling`/`PatchedOrganizationBillingUpdate` schemas were dropped
  (their backing endpoint lived in the deleted org app's legacy tree). The
  regenerated contract is the authoritative post-removal surface.
- The 34 remaining `/api/organizations/projects/{project_id}/...` paths in the
  generated contract are the **real, served** vestigial project-scoped routes
  (documented in `config/api_urls.py`; the frontend's `projectScopedApi.ts`
  calls them). No org segment, no org scoping — classified
  intentional-historical in the residual report.

**Still tracked (follow-up, not org-removal regressions):**

- Frontend `systemRoles.ts` retains org-era role templates/codes
  (`role-org-admin`, `page.organization`, `organization.view` …) that no
  backend role references; catalog cleanup is a follow-up.
- `/billing` route + `BillingPage` call `/api/v1/billing/`, which lived only in
  the deleted org app's legacy tree (404 on the de-orged backend). The route is
  fail-closed (`billing.view` was never in the backend permission catalog), so
  the page is inert; re-home or remove as a follow-up.
- `api:validate` fails at HEAD because the MSW mock runtime
  (`src/mocks/handlers`) was removed (commit `5436419`, pre-existing); the
  script needs updating or retiring.
