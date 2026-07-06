from django.core.cache import cache

from apps.identity.resolvers import (
    PermissionResolver,
)


class PermissionCache:

    PREFIX = "identity:permissions"

    @classmethod
    def make_key(
        cls,
        *,
        user,
        organization=None,
    ):
        organization_id = organization.pk if organization else "global"

        return f"{cls.PREFIX}:" f"{user.pk}:" f"{organization_id}"

    @classmethod
    def get(
        cls,
        *,
        user,
        organization=None,
    ):
        key = cls.make_key(
            user=user,
            organization=organization,
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
                timeout=3600,
            )

        return permissions

    @classmethod
    def invalidate(
        cls,
        *,
        user,
        organization=None,
    ):
        cache.delete(
            cls.make_key(
                user=user,
                organization=organization,
            )
        )

    @classmethod
    def invalidate_all(
        cls,
        user,
    ):
        """
        Call when roles/memberships change.
        """

        cache.delete_pattern(
            f"{cls.PREFIX}:{user.pk}:*",
        )
