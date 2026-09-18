"""
Permission cache service.
"""

from __future__ import annotations

import contextlib

from django.core.cache import cache

from apps.core.api.diagnostics import events
from apps.core.api.diagnostics.reasons import classify_cache_error
from apps.core.logging.logger import get_logger
from apps.identity.resolvers.permission import (
    PermissionResolver,
)


class PermissionCacheService:
    """
    Caches resolved permissions.

    Uses versioned cache keys instead of wildcard deletion.
    """

    CACHE_TIMEOUT = 60 * 60  # 1 hour

    VERSION_PREFIX = "identity.permission.version"

    PERMISSION_PREFIX = "identity.permission"

    @classmethod
    def _version_key(
        cls,
        user_id,
    ):
        return f"{cls.VERSION_PREFIX}:{user_id}"

    @classmethod
    def _permission_key(
        cls,
        *,
        user_id,
        organization_id=None,
        version=1,
    ):
        return (
            f"{cls.PERMISSION_PREFIX}:"
            f"{user_id}:"
            f"{organization_id or 'global'}:"
            f"{version}"
        )

    @classmethod
    def get_permissions(
        cls,
        *,
        user,
        organization=None,
    ):
        key = None

        try:
            version = cache.get(
                cls._version_key(user.pk),
                1,
            )

            key = cls._permission_key(
                user_id=user.pk,
                organization_id=getattr(
                    organization,
                    "pk",
                    None,
                ),
                version=version,
            )

            permissions = cache.get(key)
        except Exception as exc:
            # Cache backend unavailable (e.g. Redis down). Degrade to
            # uncached resolution rather than failing authorization — but
            # stay visible: silent fallbacks hide infrastructure outages.
            get_logger("cache").warning(
                events.CACHE_ERROR,
                backend=type(cache).__name__,
                operation="permission_lookup",
                reason=classify_cache_error(exc),
                exception_type=type(exc).__name__,
                fallback="uncached_resolution",
            )
            permissions = None

        if permissions is None:

            permissions = PermissionResolver.resolve(
                user=user,
                organization=organization,
            )

            with contextlib.suppress(Exception):
                if key is not None:
                    cache.set(
                        key,
                        permissions,
                        timeout=cls.CACHE_TIMEOUT,
                    )

        return permissions

    @classmethod
    def has_permission(
        cls,
        *,
        user,
        permission,
        organization=None,
    ):
        return permission in cls.get_permissions(
            user=user,
            organization=organization,
        )

    @classmethod
    def invalidate(
        cls,
        *,
        user,
    ):
        """
        Increment cache version.

        Old cache automatically expires.
        """
        cls.invalidate_by_id(getattr(user, "pk", None))

    @classmethod
    def invalidate_by_id(cls, user_id) -> None:
        """Increment the cache version for a user id (tolerates None)."""
        if user_id is None:
            return
        version_key = f"{cls.VERSION_PREFIX}:{user_id}"
        current = cache.get(version_key, 1)
        cache.set(version_key, current + 1, None)

    @classmethod
    def invalidate_role_holders(cls, role) -> None:
        """
        Invalidate cached permissions for every user holding ``role``.

        Covers direct assignments (UserRole), organization memberships using
        the role, and group vessels (GroupRole + live GroupMember rows).
        Queries intentionally ignore ``is_deleted``: a removed assignment
        must still evict the previously cached grant.
        """
        cls.invalidate_role_holders_by_id(getattr(role, "pk", None))

    @classmethod
    def invalidate_group_members(cls, group_id) -> None:
        """Invalidate cached permissions for every member of a group."""
        from apps.organization.models import GroupMember

        if group_id is None:
            return
        user_ids = GroupMember.objects.filter(group_id=group_id).values_list(
            "user_id", flat=True
        )
        for user_id in user_ids:
            cls.invalidate_by_id(user_id)

    @classmethod
    def invalidate_permission_holders(cls, permission) -> None:
        """Invalidate cached permissions for holders of roles granting it."""
        from apps.organization.models import RolePermission

        permission_id = getattr(permission, "pk", None)
        if permission_id is None:
            return
        role_ids = list(
            RolePermission.objects.filter(permission_id=permission_id).values_list(
                "role_id", flat=True
            )
        )
        seen_roles: set = set()
        for role_id in role_ids:
            if role_id in seen_roles:
                continue
            seen_roles.add(role_id)
            cls.invalidate_role_holders_by_id(role_id)

    @classmethod
    def invalidate_role_holders_by_id(cls, role_id) -> None:
        """Invalidate cached permissions for every holder of a role id."""
        from apps.organization.models import (
            GroupMember,
            GroupRole,
            OrganizationMembership,
            UserRole,
        )

        if role_id is None:
            return
        user_ids: set = set(
            UserRole.objects.filter(role_id=role_id).values_list("user_id", flat=True)
        )
        user_ids.update(
            OrganizationMembership.objects.filter(role_id=role_id).values_list(
                "user_id", flat=True
            )
        )
        group_ids = list(
            GroupRole.objects.filter(role_id=role_id).values_list(
                "group_id", flat=True
            )
        )
        if group_ids:
            user_ids.update(
                GroupMember.objects.filter(group_id__in=group_ids).values_list(
                    "user_id", flat=True
                )
            )
        for user_id in user_ids:
            cls.invalidate_by_id(user_id)
