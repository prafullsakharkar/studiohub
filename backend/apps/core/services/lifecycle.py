"""
Lifecycle service.
"""

from __future__ import annotations

from django.db import transaction

from apps.core.events import EventBus
from apps.core.services.audit import AuditService


class LifecycleService(AuditService):
    """
    Lifecycle management service.
    Handles activate, deactivate, archive, draft operations.
    """

    model = None
    event_map = {}

    ACTIVATE = "activate"
    DEACTIVATE = "deactivate"
    ARCHIVE = "archive"
    DRAFT = "draft"

    @classmethod
    def before_activate(cls, instance, **kwargs):
        return instance

    @classmethod
    def after_activate(cls, instance, **kwargs):
        return instance

    @classmethod
    def before_deactivate(cls, instance, **kwargs):
        return instance

    @classmethod
    def after_deactivate(cls, instance, **kwargs):
        return instance

    @classmethod
    def before_archive(cls, instance, **kwargs):
        return instance

    @classmethod
    def after_archive(cls, instance, **kwargs):
        return instance

    @classmethod
    def before_draft(cls, instance, **kwargs):
        return instance

    @classmethod
    def after_draft(cls, instance, **kwargs):
        return instance

    @classmethod
    @transaction.atomic
    def activate(cls, instance, *, user=None):
        instance = cls.before_activate(instance, user=user)
        instance = super().update(instance, user=user)
        instance = cls.after_activate(instance, user=user)
        cls._publish_event(cls.ACTIVATE, instance=instance, user=user)
        return instance

    @classmethod
    @transaction.atomic
    def deactivate(cls, instance, *, user=None):
        instance = cls.before_deactivate(instance, user=user)
        instance = super().update(instance, user=user)
        instance = cls.after_deactivate(instance, user=user)
        cls._publish_event(cls.DEACTIVATE, instance=instance, user=user)
        return instance

    @classmethod
    @transaction.atomic
    def archive(cls, instance, *, user=None):
        instance = cls.before_archive(instance, user=user)
        instance = super().update(instance, user=user)
        instance = cls.after_archive(instance, user=user)
        cls._publish_event(cls.ARCHIVE, instance=instance, user=user)
        return instance

    @classmethod
    @transaction.atomic
    def draft(cls, instance, *, user=None):
        instance = cls.before_draft(instance, user=user)
        instance = super().update(instance, user=user)
        instance = cls.after_draft(instance, user=user)
        cls._publish_event(cls.DRAFT, instance=instance, user=user)
        return instance

    @classmethod
    def _publish_event(cls, operation, **kwargs):
        event = cls.event_map.get(operation)
        if event is not None:
            EventBus.publish(event(**kwargs))
