"""
Lifecycle service.
"""

from django.db import transaction

from apps.core.choices.lifecycle import LifecycleStatus


class LifecycleService:
    """
    Handles business lifecycle state transitions.
    """

    @classmethod
    @transaction.atomic
    def change_status(
        cls,
        instance,
        status,
    ):
        instance.status = status

        instance.save(
            update_fields=[
                "status",
            ]
        )

        return instance

    @classmethod
    def draft(cls, instance):
        return cls.change_status(
            instance,
            LifecycleStatus.DRAFT,
        )

    @classmethod
    def activate(cls, instance):
        return cls.change_status(
            instance,
            LifecycleStatus.ACTIVE,
        )

    @classmethod
    def deactivate(cls, instance):
        return cls.change_status(
            instance,
            LifecycleStatus.INACTIVE,
        )

    @classmethod
    def archive(cls, instance):
        return cls.change_status(
            instance,
            LifecycleStatus.ARCHIVED,
        )
