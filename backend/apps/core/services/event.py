"""
Event service.
"""

from __future__ import annotations

from apps.core.events import EventBus

from .audit import AuditService


class EventService(AuditService):
    """
    Publishes domain events.
    """

    created_event = None

    updated_event = None

    deleted_event = None

    @classmethod
    def after_create(cls, instance):

        if cls.created_event:

            EventBus.publish(
                cls.created_event(
                    instance=instance,
                )
            )

        return instance

    @classmethod
    def after_update(cls, instance):

        if cls.updated_event:

            EventBus.publish(
                cls.updated_event(
                    instance=instance,
                )
            )

        return instance

    @classmethod
    def after_delete(cls, instance):

        if cls.deleted_event:

            EventBus.publish(
                cls.deleted_event(
                    instance=instance,
                )
            )
