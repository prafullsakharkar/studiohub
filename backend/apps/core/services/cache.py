"""
Cache service.
"""

from __future__ import annotations

from .event import EventService


class CacheService(EventService):
    """
    Cache invalidation support.
    """

    @classmethod
    def invalidate_cache(cls, instance):
        return

    @classmethod
    def after_create(cls, instance):

        instance = super().after_create(
            instance,
        )

        cls.invalidate_cache(instance)

        return instance

    @classmethod
    def after_update(cls, instance):

        instance = super().after_update(
            instance,
        )

        cls.invalidate_cache(instance)

        return instance

    @classmethod
    def after_delete(cls, instance):

        super().after_delete(instance)

        cls.invalidate_cache(instance)
