"""
Ordering service.
"""

from __future__ import annotations

from django.db import transaction

from .base import BaseService


class OrderingService(BaseService):
    """
    Service for managing ordered models.
    """

    @classmethod
    @transaction.atomic
    def move_up(cls, instance):
        if instance.order <= 1:
            return instance

        previous = instance.__class__.objects.filter(order=instance.order - 1).first()

        if previous:
            previous.order += 1
            previous.save(update_fields=["order"])

        instance.order -= 1
        instance.save(update_fields=["order"])

        return instance

    @classmethod
    @transaction.atomic
    def move_down(cls, instance):
        next_item = instance.__class__.objects.filter(order=instance.order + 1).first()

        if next_item:
            next_item.order -= 1
            next_item.save(update_fields=["order"])

            instance.order += 1
            instance.save(update_fields=["order"])

        return instance

    @classmethod
    def move_to(cls, instance, position: int):
        instance.order = position
        instance.save(update_fields=["order"])
        return instance
