from django.core.cache import cache


class PermissionCache:

    PREFIX = "rbac"

    @classmethod
    def key(
        cls,
        membership_uuid,
    ):

        return f"{cls.PREFIX}:{membership_uuid}"

    @classmethod
    def get(
        cls,
        membership_uuid,
    ):
        return cache.get(
            cls.key(
                membership_uuid,
            )
        )

    @classmethod
    def set(
        cls,
        membership_uuid,
        permissions,
    ):

        cache.set(
            cls.key(
                membership_uuid,
            ),
            permissions,
            timeout=3600,
        )

    @classmethod
    def clear(
        cls,
        membership_uuid,
    ):

        cache.delete(
            cls.key(
                membership_uuid,
            )
        )
