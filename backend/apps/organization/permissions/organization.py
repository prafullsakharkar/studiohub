"""
Organization permission classes.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from rest_framework.permissions import BasePermission

if TYPE_CHECKING:
    from rest_framework.request import Request
    from rest_framework.views import APIView

class OrganizationPermissions:
    """Organization permission codes."""

    VIEW = "organization.view_organization"
    CREATE = "organization.create_organization"
    UPDATE = "organization.update_organization"
    DELETE = "organization.delete_organization"
    MANAGE = "organization.manage_organization"


class CanViewOrganization(BasePermission):
    """Permission to view organization."""

    message = "You do not have permission to view this organization."
    code = "organization_view_denied"

    def has_object_permission(
        self,
        request,
        view,
        obj,
    ):
        """Check if user can view the organization."""
        from apps.organization.models.membership import OrganizationMembership

        return (
            OrganizationMembership.objects.active()
            .filter(
                user=request.user,
                organization=obj,
            )
            .exists()
        )


class CanCreateOrganization(BasePermission):
    """Permission to create organization."""

    message = "You do not have permission to create organizations."
    code = "organization_create_denied"

    def has_permission(self, request: Request, view: APIView) -> bool:
        """Check if user can create organizations."""
        return request.user and getattr(request.user, "is_staff", False)


class CanUpdateOrganization(BasePermission):
    """Permission to update organization."""

    message = "You do not have permission to update this organization."
    code = "organization_update_denied"

    def has_object_permission(self, request: Request, view: APIView, obj: Any) -> bool:
        """Check if user can update the organization."""
        from apps.organization.models.membership import OrganizationMembership

        return (
            OrganizationMembership.objects.active()
            .filter(
                user=request.user,
                organization=obj,
                role__code__in=["admin", "owner"],
            )
            .exists()
        )


class CanDeleteOrganization(BasePermission):
    """Permission to delete organization."""

    message = "You do not have permission to delete this organization."
    code = "organization_delete_denied"

    def has_object_permission(self, request: Request, view: APIView, obj: Any) -> bool:
        """Check if user can delete the organization."""
        return request.user and getattr(request.user, "is_staff", False)


class CanManageOrganization(BasePermission):
    """Permission to manage organization."""

    message = "You do not have permission to manage this organization."
    code = "organization_manage_denied"

    def has_object_permission(self, request: Request, view: APIView, obj: Any) -> bool:
        """Check if user can manage the organization."""
        from apps.organization.models.membership import OrganizationMembership

        return (
            OrganizationMembership.objects.active()
            .filter(
                user=request.user,
                organization=obj,
                role__code__in=["owner"],
            )
            .exists()
        )
