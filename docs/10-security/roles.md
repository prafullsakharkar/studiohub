# Roles and groups

Source: `backend/apps/identity/services/rbac.py`, `resolvers/permission.py`, ADR-0017, ADR-0033, ADR-0034.

Authorization data is flat and platform-global (no tenant column):

```
Role  --RolePermission-->  Permission
Role  <--UserRole-->       User
Group --GroupRole-->       Role
Group --GroupMember-->     User
```

A user's effective permissions are the union of their direct roles and the roles of their groups. Only
active, non-deleted roles and permissions count; a role-permission can be `granted=False` or expire
(`expires_at`). Inactive or soft-deleted users resolve to no permissions.

All writes go through `RoleService`, `GroupService` and `PermissionService` (`RbacGuardMixin`), which are transactional and fail-closed, and:

- **blocks escalation:** you cannot grant a permission you do not hold;
- **protects system rows:** system roles and permissions cannot be changed or removed by anyone but a superuser;
- **keeps an administrator:** an operation may not leave zero usable administrative holders;
- **invalidates the permission cache** synchronously and records a `SecurityEvent`.

Who may administer whom is a separate rule (`user_admin_guard.py`): you cannot act on someone who holds
more than you do, and only a superuser may act on a superuser.

Project access is not a role: it comes from `ProjectMembership` (see `authorization.md` and ADR-0033).
