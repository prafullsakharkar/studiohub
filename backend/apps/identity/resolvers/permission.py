from __future__ import annotations

from apps.identity.models import (
    GroupRole,
    OrganizationMembership,
    Permission,
    RolePermission,
    UserRole,
)

from .base import BaseResolver


class PermissionResolver(
    BaseResolver,
):
    """
    Resolves all effective permissions for a user.
    """

    @classmethod
    def resolve(
        cls,
        *,
        user,
        organization=None,
    ) -> set[str]:
        permissions = set()

        # Direct roles
        roles = UserRole.objects.filter(
            user=user,
        ).values_list(
            "role_id",
            flat=True,
        )

        # Membership roles
        if organization:
            membership = (
                OrganizationMembership.objects.filter(
                    user=user,
                    organization=organization,
                )
                .select_related("role")
                .first()
            )

            if membership and membership.role_id:
                roles = list(roles) + [membership.role_id]

        # Group roles
        group_roles = GroupRole.objects.filter(
            group__users=user,
        ).values_list(
            "role_id",
            flat=True,
        )

        roles = set(roles) | set(group_roles)

        permission_ids = RolePermission.objects.filter(
            role_id__in=roles,
        ).values_list(
            "permission_id",
            flat=True,
        )

        permissions.update(
            Permission.objects.filter(
                id__in=permission_ids,
            ).values_list(
                "code",
                flat=True,
            )
        )

        return permissions

    @classmethod
    def has_permission(
        cls,
        *,
        user,
        permission,
        organization=None,
    ) -> bool:
        return permission in cls.resolve(
            user=user,
            organization=organization,
        )
