from apps.identity.models import (
    OrganizationMembership,
)

from .base import IdentityPermission


class IsOrganizationMember(
    IdentityPermission,
):

    def has_permission(
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

    def has_permission(
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
            is_owner=True,
        ).exists()
