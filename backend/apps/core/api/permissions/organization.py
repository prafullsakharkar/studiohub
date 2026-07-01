"""
Organization permissions.
"""

from __future__ import annotations

from .base import BasePermission


class IsOrganizationMember(BasePermission):
    """
    User must belong to the object's organization.
    """

    message = "Organization membership required."

    def has_object_permission(self, request, view, obj):
        organization = getattr(obj, "organization", None)

        if organization is None:
            return False

        if not hasattr(request.user, "organizations"):
            return False

        return request.user.organizations.filter(pk=organization.pk).exists()


class IsOrganizationAdmin(IsOrganizationMember):
    """
    Organization administrator permission.
    """

    message = "Organization administrator access required."

    def has_object_permission(self, request, view, obj):
        organization = getattr(obj, "organization", None)

        if organization is None:
            return False

        membership = request.user.organizations.filter(
            pk=organization.pk,
            role="ADMIN",
        )

        return membership.exists()
