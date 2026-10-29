# PAGE AUTHORIZATION — Route Registry and Guards

Every routed page in StudioHub is permission-gated through a single registry
and a single evaluation path.

## Registry

`src/core/permissions/routePermissionsRegistry.ts`:
`ROUTE_PERMISSIONS_REGISTRY`


Each entry declares:
- `path` (route pattern)
- `pagePermission` (`page.*` code)
- `permissions` (impersonation-agnostic resource codes)
- `requiresOrgMembership` / `requiresProjectMembership` — membership gates
- `requireAny` / `requiresAdmin` — compositional knobs for aliases and admin tiers

Coverage is codified as a test: every protected route in
`src/routes/AppRoutes.tsx` must match a registry entry (phase-5 invariant).

## Guards

- `AuthProtectedRoute` — session gate.
- `OrganizationRoute` — active org context gate (fail-closed until resolved).
- `RoutePermissionGuard` — wrapped around the AppLayout shell; enforces the
  registry entry for the current path; **fail-closed** (deny ⇒ `/forbidden`,
  no registration ⇒ allow-list warning).
- `PermissionRoute` — per-route gate used by detail/edit surfaces (audit,
  platform, project administration).
- `ProjectRoute` — production scope gate using the same membership data as
  the backend (no fixture fallback).

## Behavior

- 401 (unauthenticated) → `/login`
- 403 (denied) → `/forbidden`
- 404 (nonexistent id) → resolved before content load

Access denials are structured-logged for auditability.
