# Organization Frontend Audit Report — Superseded by Org Removal

Date: 2026-09-19 (original audit); **superseded 2026-10-19 by the org removal**
(see `docs/architecture/ORGANIZATION_REMOVAL_ADR.md`).

This report documented the pre-removal organization frontend: ~60 org routes,
the organization context/switcher, workspace tabs, tenant-scoped RBAC, and the
audit surfaces that hung off `core/organization` and `modules/organization`.

## Current status: the organization layer is gone

The org module, `core/organization` (including `useOrganization`), the
`OrganizationContext`/`OrganizationSwitcher`, `/organizations/*` routes, the
`X-Organization-Id` header, and org-scoped cache keys were removed in the
org-removal work. What replaced them:

- **Flat directory entities** — Clients, Vendors, People, Departments, Teams,
  Offices are platform-wide entities with standalone routes (`/clients`,
  `/vendors`, `/people`, `/departments`, `/teams`, `/offices`) and no tenant
  scope. No `organization_id` in payloads, no org query params, no tenant header.
- **Project membership isolation** — production data is gated by project
  membership (superuser bypass). Non-members are denied at the route guard
  (`/forbidden`) and at the API layer.
- **RBAC without tenant scoping** — the permission catalog, route permission
  registry, `PermissionRoute`, and canonical permission gates are unchanged;
  the tenant-specific codes (`organization.*`, `org.access/*`, invitation/API
  key/token families) and their role grants were removed with the module.

## What the original audit fixed (historical record)

The original audit fixed catalog drift, direct-URL protection, registry/route
double-guard alignment, workspace tab permission mapping, toolbar gating,
command palette/search authorization, and organization-switch isolation. All
of that surface area was removed with the org layer; the audit's cross-cutting
fixes (permission-driven gates, fail-closed guards, registry coverage) remain
the standing pattern for the org-free app.

## Validation results (post-removal)

- E2E (Playwright, live Django backend + seed): 49/49 green, including
  platform-project-isolation, route/rest authorization, and the
  platform-workflow spec. No org URL is reachable anywhere in the suite.
- `tsc --noEmit`: clean. `pnpm vitest run`: green (see task report).
