from apps.core.logging.logger import get_logger
from apps.identity.permissions.base import (
    IdentityPermission,
)

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

        organization = getattr(
            request,
            "organization",
            None,
        )

        return all(
            PermissionCacheService.has_permission(
                user=request.user,
                permission=permission,
                organization=organization,
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
        Defense-in-depth organization consistency check for detail routes.

        Queryset scoping is the primary isolation mechanism; this denies the
        request when the resolved object demonstrably belongs to a different
        organization than the active request context (e.g. a code path that
        fetched the object outside the scoped queryset).
        """
        organization = getattr(request, "organization", None)
        obj_organization = getattr(obj, "organization", None)
        if (
            organization is not None
            and obj_organization is not None
            and getattr(obj_organization, "pk", None) != getattr(organization, "pk", None)
        ):
            logger.warning(
                "authorization_deny_object_org_mismatch",
                view=getattr(view, "__class__", type(view)).__name__,
                user_id=getattr(getattr(request, "user", None), "pk", None),
            )
            return False
        return True
