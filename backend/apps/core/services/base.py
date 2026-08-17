"""
Base service.
"""

from __future__ import annotations


class BaseService:
    """
    Base service class.
    """

    model = None

    validator_class = None

    selector_class = None

    @classmethod
    def validate(cls, **kwargs):
        """
        Execute validator hooks.
        """
        return

    @classmethod
    def publish_event(cls, operation, **kwargs):
        """
        Publish a domain event for the given operation.

        Delegates to ``_publish_event`` so subclasses that define an
        ``event_map`` publish the mapped event. No-op when no event is mapped.
        """
        cls._publish_event(operation, **kwargs)

    @classmethod
    def _publish_event(cls, operation, **kwargs):
        """
        Internal hook to publish the event mapped to ``operation``.

        No-op by default. ``CRUDService`` and ``LifecycleService`` override
        this to publish from their ``event_map``.
        """
        return

    @classmethod
    def invalidate_cache(cls, instance):
        """
        Invalidate any cached representation of ``instance``.

        No-op by default. Subclasses that integrate with a cache layer
        (e.g. ``CacheService``) override this hook.
        """
        return

    @classmethod
    def before_create(cls, **kwargs):
        return

    @classmethod
    def after_create(cls, instance):
        return instance

    @classmethod
    def before_update(cls, instance, **kwargs):
        return

    @classmethod
    def after_update(cls, instance):
        return instance

    @classmethod
    def before_delete(cls, instance):
        return

    @classmethod
    def after_delete(cls, instance):
        return
