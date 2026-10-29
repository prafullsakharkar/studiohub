# Organization Access — Enforcement Matrix

Core rule: **only `is_superuser = true` users have access to all
organizations. Every other user can access only organizations they are
explicitly permitted to access** (valid non-deleted `OrganizationMembership`).

Role labels (`Platform Admin`, `Super Admin`, `Organization Owner`) grant
nothing by themselves — everywhere. Backend is authoritative; frontend gating
is UX only. Verification sweep for this feature passed on 2026-10-05:
frontend `vitest` 53/53 (+ full `vitest run`), `tsc --noEmit`, `pnpm build`;
backend `manage.py check`, scoped pytest suites.

## Surfaces

| Surface | Enforcement point (backend authoritative) | Frontend gate (UX) | Tests |
|---|---|---|---|
| Organization list | `OrganizationViewSet.get_queryset` membership filter (`apps/organization/api/viewsets/organization.py`) and `GET /api/v1/auth/me/organizations/` (`apps/identity/api/views/auth_compat.py`) — superuser → all, members → memberships | `OrganizationContext` consumes the server-filtered list only (`src/core/organization/OrganizationContext.tsx`) | `apps/organization/tests/api/viewsets/test_org_access_scope.py` |
| Organization detail / nested resources | `resolve_organization_context` 404 boundary + `has_organization_access` (`apps/organization/middleware/organization_context.py`); nested client/vendor/contact/contract plus flat `perform_create`/`restore` gates | Browser-only (`OrganizationWorkspacePage` tab permission filter) | `test_org_access_scope.py` IDOR matrix |
| Platform master-data org scoping | `OrganizationMasterDataViewSet._require_organization_access` (superuser break-glass) (`apps/masterdata/api/viewsets/organization.py`) | `MasterDataTab` query keys include org id | `apps/masterdata/tests/test_org_bulk_enable.py` |
| Project list / detail / search | Org-scoped selectors + project rules | `filterAccessibleProjects(user, orgId, list)` in `ProjectSwitcher`/surfaces | `src/layouts/__tests__` + API suites |
| Switcher / header / palette | — (enforced via directory + detail endpoints) | `OrganizationSwitcher` lock (0/1 org), `CommandPalette`/`Header` permission gates, favorites/recents intersection, boot revalidation of persisted selection | `src/layouts/__tests__/OrganizationSwitcher.test.tsx`, `HeaderAccessGating.test.tsx`, `src/shared/components/__tests__/CommandPalette.test.tsx` |
| RBAC / permission evaluation engine | `HasPermission` + permission maps | `isPlatformSuperuser` strict (`rbac.ts`), all label bypasses removed from `checkUserHasOrgAccess`, `checkUserHasRole`, `evaluateUserPermission`, `externalAccessEngine` (org-less Owner label grants eliminated; Owner authority is org-bound) | `src/core/permissions/__tests__/isPlatformSuperuser.test.ts`, `externalAccessEngineStrictSuperuser.test.ts` |
| Zero-org user | Backend returns an empty scoped list | `org-empty-badge` (OrganizationSwitcher), no default org selection | `OrganizationSwitcher.test.tsx` |

## Known follow-ups (tracked, not blockers)

- **Version/env display:** no live backend info endpoint exists and the
  header carries no version/env label today, so "version/environment
  information is correct" is satisfied as "no hardcoded values to fix".
  Add `GET /api/v1/info/version/` + header wiring as a separate cross-repo
  task — do not fabricate a source.
- **Zero-org E2E:** `test.fixme` in `e2e/org-access.spec.ts` pending a seeded
  user with zero memberships.
- **Org-less base-role evaluation:** legacy `organization_id` fallback in
  `checkUserHasOrgAccess` and base-role template grants
  (`SYSTEM_ROLE_TEMPLATES`, e.g. `Organization Owner → ['*']`) are retained
  by design for org-LESS evaluation; org-SCOPED evaluation is fully
  membership-bound (tests pin both). Backend remains the anti-leak barrier.
