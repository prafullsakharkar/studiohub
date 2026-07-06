"""
Permission cache service.
"""

from __future__ import annotations

from django.core.cache import cache

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

        if permissions is None:

            permissions = PermissionResolver.resolve(
                user=user,
                organization=organization,
            )

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

        version_key = cls._version_key(
            user.pk,
        )

        current = cache.get(
            version_key,
            1,
        )

        cache.set(
            version_key,
            current + 1,
            None,
        )
