# Permissions

Source: `backend/apps/core/permissions/`, `apps/identity/constants/permissions.py`, ADR-0017, ADR-0033.

- **Codes** are dotted strings, `<app>.<resource>.<action>`, for example `identity.user.view` or
  `audit.view`. The constants live next to each app (`<app>/constants/permissions.py`).
- **Deny by default.** Viewsets declare a `permission_map` of action to codes. An action with no entry is
  denied; an empty tuple means any signed-in user; several codes mean any one of them suffices.
- **Resolution** is `PermissionResolver` (see `roles.md`), cached per user by `PermissionCacheService`.
  Changing a role, a role's permissions or group membership invalidates the cache.
- **Superusers** are allowed by the permission classes.
- **Scoped credentials.** An API key or personal access token carries a scope list and may use only the
  actions it was given (`permissions/scopes.py`, ADR-0036); an action not opened to credentials is refused
  even when the owner holds the permission.
- **What a permission does not decide:** which rows. Project data is narrowed by `ProjectMembership`
  (internal members see the project; vendor and client members only what they were given), and audit rows
  by project (`docs/api/audit.md`).
