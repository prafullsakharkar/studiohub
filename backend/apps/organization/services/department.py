"""
Department write service.
"""

from __future__ import annotations

from django.db import transaction

from apps.core.events import EventBus
from apps.organization.events import (
    DepartmentArchived,
    DepartmentCreated,
    DepartmentDeleted,
    DepartmentManagerAssigned,
    DepartmentMoved,
    DepartmentUpdated,
)
from apps.organization.models import Department

from .base import OrganizationBaseService


class DepartmentService(OrganizationBaseService):
    """
    Handles all write operations for Department.
    """

    model = Department

    @classmethod
    @transaction.atomic
    def create(cls, **validated_data):
        department = cls.model.objects.create(**validated_data)

        EventBus.publish(
            DepartmentCreated(instance=department),
        )

        return department

    @classmethod
    @transaction.atomic
    def update(cls, instance, **validated_data):
        for field, value in validated_data.items():
            setattr(instance, field, value)

        instance.save()

        EventBus.publish(
            DepartmentUpdated(instance=instance),
        )

        return instance

    @classmethod
    @transaction.atomic
    def archive(cls, instance):
        instance.archive()

        EventBus.publish(DepartmentArchived(instance=instance))

        return instance

    @classmethod
    @transaction.atomic
    def delete(cls, instance):
        instance.delete()

        EventBus.publish(
            DepartmentDeleted(instance=instance),
        )

    @classmethod
    @transaction.atomic
    def assign_manager(
        cls,
        instance,
        manager,
    ):
        instance.manager = manager
        instance.save(update_fields=["manager"])

        EventBus.publish(
            DepartmentManagerAssigned(
                instance=instance,
                manager=manager,
            )
        )

        return instance

    @classmethod
    @transaction.atomic
    def move(
        cls,
        instance,
        parent,
    ):
        instance.parent = parent
        instance.save(update_fields=["parent"])

        EventBus.publish(
            DepartmentMoved(
                instance=instance,
                parent=parent,
            )
        )

        return instance
