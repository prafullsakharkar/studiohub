"""
Lifecycle mixin.
"""

from __future__ import annotations

from django.db import transaction

from apps.core.services.lifecycle import LifecycleService


class LifecycleMixin:
    """
    Lifecycle operations.
    """

    @classmethod
    @transaction.atomic
    def activate(cls, instance):
        cls.validate(
            "activate",
            instance=instance,
        )

        instance = LifecycleService.activate(instance)

        cls.publish_event(
            "activate",
            instance=instance,
        )

        cls.invalidate_cache(instance)

        return instance

    @classmethod
    @transaction.atomic
    def deactivate(cls, instance):
        cls.validate(
            "deactivate",
            instance=instance,
        )

        instance = LifecycleService.deactivate(instance)

        cls.publish_event(
            "deactivate",
            instance=instance,
        )

        cls.invalidate_cache(instance)

        return instance

    @classmethod
    @transaction.atomic
    def archive(cls, instance):
        cls.validate(
            "archive",
            instance=instance,
        )

        instance = LifecycleService.archive(instance)

        cls.publish_event(
            "archive",
            instance=instance,
        )

        cls.invalidate_cache(instance)

        return instance

    @classmethod
    @transaction.atomic
    def draft(cls, instance):
        cls.validate(
            "draft",
            instance=instance,
        )

        instance = LifecycleService.draft(instance)

        cls.publish_event(
            "draft",
            instance=instance,
        )

        cls.invalidate_cache(instance)

        return instance
