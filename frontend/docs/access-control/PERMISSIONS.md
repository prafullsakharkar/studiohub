# PERMISSIONS — Canonical Permission Codes and Resolution

Source of truth for what permissions exist, how they are evaluated, and
where the catalog lives.

## Permission codes

Canonical format (ADR-0033 D3):

```
<resource>.<action>
```

…with dot namespacing for families that need it (`organization.role.view`,
`identity.user.create`, `platform.master_data.configure`). A colon-separated
format (`shots:read`) is **legacy** and no longer used anywhere — the frontend
compat map (`LEGACY_TO_CANONICAL_MAP`) exists only for transitional payload
normalization and is scheduled for removal (see MOCK-REST-AUTH.md).

Canonical action verbs: `view · create · update · delete · archive · restore ·
approve · publish · assign · import · export · manage · configure`.

## Families (as shipped)

| Family | Where | Examples |
|---|---|---|
| Organization-scoped RBAC | `apps/organization/constants/permissions.py` | `organization.update`, `group.view`, `organization_membership.create` |
| Identity | `apps/identity/constants/permissions.py` | `identity.user.view`, `identity.user.archive` |
| Production | `apps/production/constants/permissions.py` | `shot.view`, `project.create`, `review.approve` |
| Publishing/deliveries/scheduling/audit | their constants modules | `delivery.view`, `schedule.manage`, `audit.view` |
| Platform admin | `apps/platform/constants/permissions.py` | `settings.view`, `settings.manage`, `platform.master_data.configure`, `report.view`, `notification.view` |
| `page.*` | Central RBAC tables (frontend) | `page.projects`, `page.project.shots` |

## Resolution (backend)

```
HasPermission (DRF gate)
  → PermissionCacheService.has_permission
  → PermissionResolver.resolve
      = direct UserRole + active membership role + group roles
      — soft-delete + is_active filters on every hop
```

Deny-by-default:
- viewsets declare `permission_map`; missing entry ⇒ DENY (403).
- no evidence of grant ⇒ DENY.

`is_superuser` is the only bypass** (logged). `is_staff` is not an
authorization tier (ADR-0033 D4).

Caching:
- Per-user permission cache, invalidated on every role/membership/permission mutation.

## Resolution (frontend)

The single public evaluator is `can(user, { permission, organizationId?,
projectId?, showId?, resource?, action?, entity?, scope? })` in
`src/core/permissions/can.ts`, reused by `usePermissions()` and every
guard/gate component. It is UX-only — the backend re-checks every request.

Role display names are resolved to their canonical permission list by
`SYSTEM_ROLE_TEMPLATES` (`src/core/permissions/systemRoles.ts`). No parallel
role catalog exists anymore; the legacy "enterprise" mapping and the
simulation store were removed (see IMPLEMENTATION-STATUS.md).
