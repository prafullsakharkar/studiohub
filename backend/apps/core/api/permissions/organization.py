"""
Organization permissions.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from .base import BasePermission

if TYPE_CHECKING:
    from rest_framework.request import Request
    from rest_framework.views import APIView

class IsOrganizationMember(BasePermission):
    """
    User must belong to the object's organization.
    """

    message = "Organization membership required."

    def has_object_permission(self, request: Request, view: APIView, obj: Any) -> bool:
        organization = getattr(obj, "organization", None)

        if organization is None:
            return False

        organizations = getattr(request.user, "organizations", None)
        if organizations is None:
            return False

        return organizations.filter(pk=organization.pk).exists()


class IsOrganizationAdmin(IsOrganizationMember):
    """
    Organization administrator permission.
    """

    message = "Organization administrator access required."

    def has_object_permission(self, request: Request, view: APIView, obj: Any) -> bool:
        organization = getattr(obj, "organization", None)

        if organization is None:
            return False

        organizations = getattr(request.user, "organizations", None)
        if organizations is None:
            return False
        membership = organizations.filter(
            pk=organization.pk,
            role="ADMIN",
        )

        return membership.exists()


class OrganizationPermission(IsOrganizationMember):
    """
    Alias for IsOrganizationMember for backward compatibility.
    """
