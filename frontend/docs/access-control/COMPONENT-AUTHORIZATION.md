# COMPONENT AUTHORIZATION — Action Gating Inside Pages

Every sensitive UI action uses the same canonical evaluator as the rest of
the app (no parallel engines).

## Canonical surface

- `usePermissions()` → returns `{ can, hasPermission, hasAnyPermission,
  hasAllPermissions, canPerform, hasRole }` — auth-backed, org context aware.
- `can(user, { permission, organizationId?, projectId?, showId?, resource?,
  action?, entity?, scope? })` — the object-form entry point
  (`src/core/permissions/can.ts`).
- `canPerform(entity, action)` — CRUD/bulk shorthand that maps to
  `${resource}.${action}`.

## Behavior modes

- `<PermissionGate permission="...">` — hides children when denied (fallback optional)
- `<PermissionButton permission="...">` — disables with a reason when denied
- `PermissionControl` / `usePermissionControl(...)` — `disable` (default), `hide`, `readOnly`, `visible`
- `<Can permission="...">` — legacy string-only wrapper (kept; delegates to the engine)

## What is protected (non-exhaustive)

- create/edit/delete/archive/restore buttons on entity pages
- bulk action handlers in lists
- approve/publish/assign/ingest controls on work items
- settings and master-data write flows
- access-management operations

Denied actions are hidden/disabled by contract, and the same request denied
again by the backend (backend is authoritative — hidden UI is only a UX hint).
