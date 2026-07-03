"""
Soft delete mixin.
"""

from __future__ import annotations

from django.db import transaction

from apps.core.services.soft_delete import SoftDeleteService


class SoftDeleteMixin:
    """
    Soft delete operations.
    """

    @classmethod
    @transaction.atomic
    def delete(
        cls,
        instance,
        *,
        user=None,
    ):
        cls.validate(
            "delete",
            instance=instance,
        )

        instance = SoftDeleteService.delete(
            instance,
            user=user,
        )

        cls.publish_event(
            "delete",
            instance=instance,
            user=user,
        )

        cls.invalidate_cache(instance)

        return instance

    @classmethod
    @transaction.atomic
    def restore(
        cls,
        instance,
    ):
        cls.validate(
            "restore",
            instance=instance,
        )

        instance = SoftDeleteService.restore(instance)

        cls.publish_event(
            "restore",
            instance=instance,
        )

        cls.invalidate_cache(instance)

        return instance

    @classmethod
    @transaction.atomic
    def hard_delete(
        cls,
        instance,
    ):
        cls.validate(
            "hard_delete",
            instance=instance,
        )

        SoftDeleteService.hard_delete(instance)

        cls.publish_event(
            "hard_delete",
            instance=instance,
        )

        cls.invalidate_cache(instance)
