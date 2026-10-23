from apps.core.logging.logger import get_logger
from apps.identity.permissions.base import (
    IdentityPermission,
)
from apps.identity.permissions.scopes import credential_scopes

logger = get_logger("authorization")


class HasPermission(
    IdentityPermission,
):
    def has_permission(  # pyright: ignore[reportIncompatibleMethodOverride]
        self,
        request,
        view,
    ):
        permissions = view.get_permission_required()

        if permissions is None:
            # Fail closed: an action without a permission_map entry is
            # denied. Actions intentionally open to every authenticated user
            # must declare an explicit empty tuple ().
            logger.warning(
                "authorization_deny_no_map_entry",
                view=getattr(view, "__class__", type(view)).__name__,
                action=getattr(view, "action", None),
                user_id=getattr(getattr(request, "user", None), "pk", None),
            )
            return False

        if not permissions:
            return True

        user = request.user

        # A scoped API key / PAT can do only what its scopes list, however
        # much its owner may do (WP 7.3, DOM-CRED-04). No scopes recorded
        # means a legacy credential with the owner's full access.
        scopes = credential_scopes(request)

        if scopes is not None and not all(code in scopes for code in permissions):
            logger.warning(
                "authorization_deny_credential_scope",
                user_id=getattr(user, "pk", None),
                view=getattr(view, "__class__", type(view)).__name__,
                action=getattr(view, "action", None),
            )
            return False

        # The superuser break-glass applies to the owner's own permissions;
        # for a scoped credential the scope check above has already narrowed
        # it to exactly the listed codes, so it never exceeds its scopes.
        if getattr(user, "is_superuser", False):
            # Documented break-glass: superusers bypass code checks. Staff
            # (is_staff) is NOT a bypass — staff resolve permissions through
            # the same role grants as everyone else. See ADR.
            logger.warning(
                "authorization_superuser_bypass",
                user_id=getattr(user, "pk", None),
                view=getattr(view, "__class__", type(view)).__name__,
                action=getattr(view, "action", None),
            )
            return True

        # Imported lazily to avoid circular imports at app-load time.
        from apps.identity.services.permission_cache import (
            PermissionCacheService,
        )

        # Platform-global resolution: no organization context is consulted.
        return all(
            PermissionCacheService.has_permission(
                user=request.user,
                permission=permission,
            )
            for permission in permissions
        )

    def has_object_permission(  # pyright: ignore[reportIncompatibleMethodOverride]
        self,
        request,
        view,
        obj,
    ):
        """
        Object-level check for platform-global resources.

        Queryset scoping is the primary isolation mechanism; with no
        organization partition there is no cross-tenant mismatch to deny.
        """
        return True
