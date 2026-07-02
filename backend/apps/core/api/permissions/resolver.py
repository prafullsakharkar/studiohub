"""
Permission resolver.
"""

from __future__ import annotations


class PermissionResolver:
    """
    Resolves permission codes against the authenticated user's membership.
    """

    @classmethod
    def has_permission(
        cls,
        request,
        permission_code: str,
    ) -> bool:
        """
        Check whether the current request has a permission.
        """

        user = request.user

        if not user.is_authenticated:
            return False

        if user.is_superuser:
            return True

        membership = getattr(
            request,
            "membership",
            None,
        )

        if membership is None:
            return False

        return membership.has_permission(
            permission_code,
        )
