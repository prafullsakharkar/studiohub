# Permissions Contract

## Enforcement Chain

The frontend hides UI affordances but never enforces authorization. The backend chain is:

```
Authentication (JWT Bearer)
      ↓
Organization scope (X-Organization-Id header → membership resolution)
      ↓
Role (OrganizationMembership.role / UserRole)
      ↓
Permission codes (Permission.code, e.g. "shots:approve")
      ↓
Object-level checks (owner/manager/lead where applicable)
      ↓
Service operation (business rules, transactions, events)
```

## Wire-Level Contract

- Frontend sends `X-Organization-Id: <uuid>` on every request
  (`ApiClient.ts`, value from `studiohub_active_org_id`).
- Frontend receives `permissions: string[]` on the login/`me` user payload using
  `module:action` codes (e.g. `shots:approve`, `projects:create`). These strings must be
  derived from the backend `Permission.code` values so UI gating matches enforcement.
- `role` on the user payload is a display string (`'Platform Admin'`,
  `'VFX Supervisor'`, …).

## Backend Architecture (existing, reuse — do not duplicate)

- Context resolution: organization middleware +
  `resolve_organization_context(request)` in
  `apps/organization/middleware/organization_context.py`, applied by
  `OrganizationScopedViewSet.perform_authentication`
  (`apps/organization/api/viewsets/scoped.py`) for domain viewsets.
- Queryset scoping: core `BaseSelector.scope_by_request(...)` (fail closed when no
  organization context resolves) keyed by `scope_field` (default `organization`);
  `OrganizationBaseSelector` overrides it to allow platform-staff bypass. Domain
  viewsets opt in via `OrganizationScopedViewSet` (deliveries, publishing, and
  scheduling use it); mutation services accept an explicit `organization_id` and
  resolve objects through it.
- Code-level checks: `HasPermission` permission class
  (`apps/identity/permissions/permission.py`) reading `view.permission_map` →
  `PermissionCacheService.has_permission(user, code, organization=…)`;
  staff/superuser short-circuit.
- Models live in `apps.organization`: `Role`, `Permission`, `RolePermission`,
  `UserRole`, `Group`/`GroupMember`/`GroupRole`, `OrganizationMembership`.
- Known duplication: `RBACPermission` → `AuthorizationResolver.resolve` exists parallel
  to `HasPermission`; document as tech debt, prefer one checker.

## Rules for New Endpoints

1. Every production viewset must declare `permission_map` entries (or equivalent
   declarative requirement) — no anonymous production endpoints.
2. Never authorize inside serializers; permissions belong to the view/service boundary.
3. Object-level rules (e.g. only reviewer closes their session) live in services or
   object permissions, not in views.
4. Multi-org users: all reads/writes are scoped by request organization; cross-org access
   requires an explicit platform-staff path.
