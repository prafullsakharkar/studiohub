from apps.identity.permissions.permission import HasPermission


class RBACPermission(HasPermission):
    """
    Deprecated alias for HasPermission.

    Consolidated in Phase F: both checkers now share the same implementation
    (HasPermission → PermissionCacheService). RBACPermission is kept for
    backward compatibility and will be removed in a future release.
    """
