from apps.identity.permissions.base import (
    IdentityPermission,
)


class HasPermission(
    IdentityPermission,
):

    def has_permission(
        self,
        request,
        view,
    ):
        permissions = view.get_permission_required()

        if not permissions:
            return True

        if getattr(request.user, "is_staff", False) or getattr(request.user, "is_superuser", False):
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
