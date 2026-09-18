from __future__ import annotations

from django.db.models import Q

from apps.organization.models import (
    GroupMember,
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

    Fail-closed rules applied on every hop:

    * inactive or soft-deleted users resolve to no permissions;
    * only active memberships (``status="active"``) confer their role;
    * only active, non-deleted roles confer permissions;
    * only granted (``granted=True``), non-deleted role-permission rows count;
    * only active, non-deleted permissions are returned;
    * organization-scoped roles (``role.organization`` set) apply only inside
      that organization; global roles (``organization`` null) apply everywhere.
      Without an organization context, only global roles apply.

    NOTE: domain managers do not exclude soft-deleted rows (only
    ``SoftDeleteManager`` does), so every hop filters ``is_deleted=False``
    explicitly.
    """

    @classmethod
    def _role_scope_filter(cls, organization):
        if organization is None:
            return Q(role__organization__isnull=True)
        return Q(role__organization__isnull=True) | Q(role__organization=organization)

    @classmethod
    def resolve(
        cls,
        *,
        user,
        organization=None,
    ) -> set[str]:
        if user is None:
            return set()

        if not getattr(user, "is_active", False):
            return set()

        if getattr(user, "is_deleted", False):
            return set()

        user_pk = getattr(user, "pk", None)
        if user_pk is None:
            return set()

        roles: set = set()

        # Direct roles (global or scoped to this organization).
        direct_role_ids = UserRole.objects.filter(
            user_id=user_pk,
            is_deleted=False,
            role__is_deleted=False,
            role__is_active=True,
        ).filter(
            cls._role_scope_filter(organization),
        ).values_list(
            "role_id",
            flat=True,
        )
        roles.update(direct_role_ids)

        # Membership role (active membership in this organization only).
        if organization is not None:
            membership = (
                OrganizationMembership.objects.filter(
                    user_id=user_pk,
                    organization=organization,
                    status="active",
                    is_deleted=False,
                )
                .select_related("role")
                .first()
            )

            if (
                membership is not None
                and membership.role_id
                and not getattr(membership.role, "is_deleted", False)
                and getattr(membership.role, "is_active", False)
            ):
                membership_role_org = getattr(membership.role, "organization_id", None)
                if membership_role_org is None or membership_role_org == getattr(
                    organization, "pk", None
                ):
                    roles.add(membership.role_id)

        # Group roles (user's live group memberships; same role scoping as
        # direct roles). GroupMember rows are resolved explicitly so
        # soft-deleted memberships stop conferring permissions (M2M
        # traversal would ignore the through-model ``is_deleted`` flag).
        member_group_ids = GroupMember.objects.filter(
            user_id=user_pk,
            is_deleted=False,
            group__is_deleted=False,
        ).values_list("group_id", flat=True)
        group_role_ids = GroupRole.objects.filter(
            group_id__in=member_group_ids,
            is_deleted=False,
            role__is_deleted=False,
            role__is_active=True,
        ).filter(
            cls._role_scope_filter(organization),
        ).values_list(
            "role_id",
            flat=True,
        )
        roles.update(group_role_ids)

        if not roles:
            return set()

        permission_ids = RolePermission.objects.filter(
            role_id__in=roles,
            granted=True,
            is_deleted=False,
        ).values_list(
            "permission_id",
            flat=True,
        )

        permissions = set(
            Permission.objects.filter(
                id__in=permission_ids,
                is_active=True,
                is_deleted=False,
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
