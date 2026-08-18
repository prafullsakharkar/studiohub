"""
Soft delete service.
"""

from __future__ import annotations

from django.utils import timezone

from .base import BaseService


class SoftDeleteService(BaseService):
    """
    Service for soft delete operations.
    """

    @classmethod
    def delete(cls, instance, user=None):
        """
        Soft delete an instance.
        """
        instance.is_deleted = True
        instance.deleted_at = timezone.now()

        if hasattr(instance, "deleted_by"):
            instance.deleted_by = user

        update_fields = ["is_deleted", "deleted_at"]
        if hasattr(instance, "deleted_by"):
            update_fields.append("deleted_by")

        instance.save(update_fields=update_fields)

        return instance

    @classmethod
    def restore(cls, instance):
        """
        Restore a soft-deleted instance.
        """
        instance.is_deleted = False
        instance.deleted_at = None

        if hasattr(instance, "deleted_by"):
            instance.deleted_by = None

        update_fields = ["is_deleted", "deleted_at"]
        if hasattr(instance, "deleted_by"):
            update_fields.append("deleted_by")

        instance.save(update_fields=update_fields)

        return instance

    @classmethod
    def hard_delete(cls, instance):
        """
        Permanently remove an instance from the database.

        Uses ``Model.delete`` directly to bypass the soft-delete override on
        ``SoftDeleteModel``.
        """
        from django.db import models

        models.Model.delete(instance)
