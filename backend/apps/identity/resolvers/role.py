from apps.identity.models import (
    GroupRole,
    OrganizationMembership,
    UserRole,
)

from .base import BaseResolver


class RoleResolver(
    BaseResolver,
):

    @classmethod
    def resolve(
        cls,
        *,
        user,
        organization=None,
    ):
        roles = set(
            UserRole.objects.filter(
                user=user,
            ).values_list(
                "role__code",
                flat=True,
            )
        )

        roles.update(
            GroupRole.objects.filter(
                group__users=user,
            ).values_list(
                "role__code",
                flat=True,
            )
        )

        if organization:
            membership = (
                OrganizationMembership.objects.filter(
                    user=user,
                    organization=organization,
                )
                .select_related("role")
                .first()
            )

            if membership and membership.role:
                roles.add(
                    membership.role.code,
                )

        return roles
