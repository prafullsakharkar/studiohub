from __future__ import annotations

from django.db.models import Q
from django.utils import timezone

from apps.identity.models import (
    GroupMember,
    GroupRole,
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

    Platform-global: roles apply everywhere, with no organization scoping.

    Fail-closed rules applied on every hop:

    * inactive or soft-deleted users resolve to no permissions;
    * only active, non-deleted roles confer permissions;
    * only granted (``granted=True``), non-deleted role-permission rows count;
    * only unexpired role-permission rows count (``expires_at`` is null or in
      the future);
    * only active, non-deleted permissions are returned.

    NOTE: domain managers do not exclude soft-deleted rows (only
    ``SoftDeleteManager`` does), so every hop filters ``is_deleted=False``
    explicitly.
    """

    @classmethod
    def resolve(
        cls,
        *,
        user,
        organization=None,
    ) -> set[str]:
        # ``organization`` is accepted for backwards compatibility with
        # callers that have not been migrated off org-scoped resolution yet;
        # it is ignored — resolution is platform-global.
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

        # Direct global role assignments.
        direct_role_ids = UserRole.objects.filter(
            user_id=user_pk,
            is_deleted=False,
            role__is_deleted=False,
            role__is_active=True,
        ).values_list(
            "role_id",
            flat=True,
        )
        roles.update(direct_role_ids)

        # Group roles (user's live group memberships). GroupMember rows are
        # resolved explicitly so soft-deleted memberships stop conferring
        # permissions (M2M traversal would ignore the through-model
        # ``is_deleted`` flag).
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
        ).filter(
            Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now()),
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
