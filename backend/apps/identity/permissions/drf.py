from rest_framework.permissions import BasePermission

from apps.identity.authorization import (
    PermissionChecker,
)


class RBACPermission(
    BasePermission,
):

    def has_permission(
        self,
        request,
        view,
    ):

        permission = view.get_required_permission()

        organization = view.get_organization()

        return PermissionChecker.has_permission(
            user=request.user,
            organization=organization,
            permission=permission,
        )
