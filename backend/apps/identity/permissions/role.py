from apps.identity.permissions.base import (
    IdentityPermission,
)
from apps.identity.resolvers import (
    RoleResolver,
)


class HasRole(
    IdentityPermission,
):

    def has_permission(
        self,
        request,
        view,
    ):
        role = getattr(
            view,
            "role_required",
            None,
        )

        if role is None:
            return True

        return role in RoleResolver.resolve(
            user=request.user,
        )
