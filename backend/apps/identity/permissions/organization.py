from apps.organization.models import (
    OrganizationMembership,
)

from .base import IdentityPermission


class IsOrganizationMember(
    IdentityPermission,
):

    def has_permission(  # pyright: ignore[reportIncompatibleMethodOverride]
        self,
        request,
        view,
    ):
        organization = getattr(
            request,
            "organization",
            None,
        )

        if organization is None:
            return False

        return OrganizationMembership.objects.filter(
            organization=organization,
            user=request.user,
        ).exists()


class IsOrganizationOwner(
    IdentityPermission,
):

    def has_permission(  # pyright: ignore[reportIncompatibleMethodOverride]
        self,
        request,
        view,
    ):
        from apps.organization.choices.role_priority import RolePriority

        organization = getattr(
            request,
            "organization",
            None,
        )

        if organization is None:
            return False

        # NOTE: OrganizationMembership has no is_owner flag; ownership is the
        # highest-priority (ADMIN) role within the organization.
        return OrganizationMembership.objects.filter(
            organization=organization,
            user=request.user,
            role__priority=RolePriority.ADMIN,
        ).exists()
