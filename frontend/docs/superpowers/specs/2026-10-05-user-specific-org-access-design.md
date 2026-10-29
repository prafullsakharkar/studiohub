# User-Specific Organization Access — Design Spec

Date: 2026-10-05
Status: Design approved (pending spec-file review)
Scope: `studiohub-react` (frontend) + `../studiohub` (Django backend)
Approach: A — audit-and-harden on ADR-0033 (approved 2026-10-05)

## 1. Core Rule

> **Only `is_superuser = true` users have access to all organizations.
> Every other user can access only organizations they are explicitly
> permitted to access (valid organization membership).**

- Superuser (`user.is_superuser === true`): all organizations everywhere
  (switcher, search, APIs). No explicit membership required.
- Normal user (`is_superuser === false`): only explicitly permitted
  organizations. Inaccessible orgs must be undiscoverable (no search hits),
  unopenable (no URL/UUID access), and unusable (APIs reject).
- Strict superuser-only (ruling 2026-10-05): the `Platform Admin` /
  `Super Admin` **role labels are NOT equivalent** to `is_superuser`.
  Role-labeled non-superusers follow membership rules.
- Single-org rule: a user with exactly 1 accessible organization sees **no**
  organization dropdown; the org locks in after authentication and its
  details load accordingly.

## 2. Ground Truth (Do Not Re-Invent)

Backend (`../studiohub`):

- `OrganizationViewSet.get_queryset` scopes by membership; superuser bypass
  (`backend/apps/organization/api/viewsets/organization.py:74`).
- `GET /api/v1/auth/me/organizations/` returns exactly accessible orgs
  (ADR-0033 D5) (`backend/apps/identity/api/views/auth_compat.py:162`).
- `has_organization_access` middleware helper: superuser → True, else
  requires `request.membership`
  (`backend/apps/organization/middleware/organization_context.py:79`).
- Selectors scope non-superusers by membership (e.g. `selectors/base.py:67`).

Frontend (`studiohub-react`):

- `OrganizationContext` consumes the server-filtered directory only, with
  fail-closed `switchOrganization` and full `queryClient.clear()` on switch
  (`src/core/organization/OrganizationContext.tsx`).
- Centralized checks: `isPlatformSuperuser` (`rbac.ts:793`),
  `checkUserHasOrgAccess` (`rbac.ts:173`), `filterAccessibleOrganizations`
  (`accessControl.ts:39`).
- Header: `OrganizationSwitcher`, `ProjectSwitcher`, `CommandPalette`
  (`src/layouts/`).

Known violation to fix: `isPlatformSuperuser` currently also returns true
for `role === 'Platform Admin'/'Super Admin'` labels (`rbac.ts:795-800`).

## 3. Backend Enforcement (§1 of design)

- Superuser gate is strict `request.user.is_superuser` everywhere; close any
  `is_staff` / role-label bypass on org-scoped list/detail/search endpoints
  and project endpoints (org membership AND project rules).
- `has_organization_access` remains the single choke point for plain APIViews.
- List APIs stay query-time scoped (superuser → all; members → valid
  memberships, `is_deleted=False`); never return-then-filter.
- IDOR matrix: member-of-A+B requesting B/C orgs, projects, people,
  departments, teams, offices, clients, vendors, dashboards, reports, search
  → rejected (403/404 per established convention). UUID in URL/body/query
  grants nothing without membership.
- Reuse selectors, `permission_map`, `OrganizationContextMixin`,
  `HasPermission`. No new permission model.

## 4. Frontend Context & Selection (§2 of design)

- Tighten `isPlatformSuperuser` to `Boolean(user.is_superuser)` only; remove
  role-label fallbacks. All downstream helpers inherit; no component-level
  auth logic added.
- `userOrganizations` memo remains the single derived list for switcher,
  search, palette, breadcrumbs. No parallel lists.
- Keep fail-closed switch + cache clear; add single-org lock (no dropdown,
  auto-lock post-auth, details load) and zero-org empty state (never load an
  arbitrary org). Revalidate persisted `studiohub_active_org_id` against the
  directory on boot → first permitted org.
- Scope query keys (`['organizations', userId]`,
  `['projects', organizationId, userId]`, search keys likewise) per existing
  architecture; filter favorites/recents against accessible ids; never persist
  an inaccessible selection.

## 5. Header, Search & Projects (§3 of design)

- `OrganizationSwitcher`: accessible orgs only, dropdown hidden for
  single-org, selection locked. `ProjectSwitcher`: current-org permitted
  projects only; resets on org switch (keep `resetActiveProjectForOrg` /
  `setActiveProject(null)`, extend clearing to search/palette state).
- Audit every header control (profile, notifications, search, breadcrumbs,
  settings/help/admin/platform-services, version/env): access-scoped data,
  permission-gated visibility; admin entries require superuser or grant.
- All search (org/project/people/client/vendor/global/palette) hits
  permission-scoped endpoints with org context; no fetch-all-filter-in-React;
  org switch clears prior results and re-keys queries.
- Project access = org access AND project rules (org access alone grants
  nothing project-level beyond existing rules).
- Version/environment from the existing version/configuration mechanism
  (backend info endpoint where present); fix hardcoded/stale values found.

## 6. Tests, Edge States & Acceptance (§4 of design)

Backend (pytest): superuser-all/member-subset; list filtering; detail 403 on
unpermitted org via URL-UUID swap; project endpoints same matrix; search
excludes; revoked-membership; zero-org.

Frontend (vitest): switcher subset; single-org lock (no dropdown); guarded
direct-URL denial; org switch clears project/search/dashboard; key isolation;
zero-org state.

E2E (playwright): User 1 vs User 2 flows, org-switch cascade, single-org lock.

Commands: `uv run python manage.py check`, `uv run pytest`; `pnpm lint`,
`pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e` (adjust to actual
script names).

Acceptance: §20 Definition of Done verbatim from the request plus the
single-org rule. No frontend-only enforcement, no duplicated auth system.

## 7. Open Items for Planning

- Exact frontend script names (`lint`, `test:e2e` presence) — verify from
  `package.json`.
- Phasing: backend strictness → frontend scoping/UX → tests/E2E (per
  recommended approach A).
- Confirm no production reliance on the `Platform Admin` role-label bypass
  beyond code (migration/seed audit during implementation).
