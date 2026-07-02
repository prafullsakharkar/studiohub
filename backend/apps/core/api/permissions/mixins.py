"""
Permission map mixin.
"""

from rest_framework.permissions import BasePermission

from .resolver import PermissionResolver


class PermissionMapPermission(BasePermission):
    """
    Reads permission codes from the ViewSet.
    """

    def has_permission(
        self,
        request,
        view,
    ):

        permission_map = getattr(
            view,
            "permission_map",
            {},
        )

        required = permission_map.get(
            view.action,
            (),
        )

        if not required:
            return True

        return all(
            PermissionResolver.has_permission(
                request,
                permission,
            )
            for permission in required
        )
