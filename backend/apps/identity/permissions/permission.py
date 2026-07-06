from apps.identity.permissions.base import (
    IdentityPermission,
)
from apps.identity.services.permission_cache import (
    PermissionCacheService,
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
