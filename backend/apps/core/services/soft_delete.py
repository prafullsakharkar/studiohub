"""
Soft delete service.
"""

from __future__ import annotations

from django.utils import timezone

from apps.core.choices import RecordStatus

from .base import BaseService


class SoftDeleteService(BaseService):
    """
    Service for soft delete operations.
    """

    @classmethod
    def delete(cls, instance, user=None):
        instance.is_deleted = True
        instance.status = RecordStatus.DELETED
        instance.deleted_at = timezone.now()

        if hasattr(instance, "deleted_by"):
            instance.deleted_by = user

        instance.save(
            update_fields=(
                [
                    "is_deleted",
                    "status",
                    "deleted_at",
                    "deleted_by",
                ]
                if hasattr(instance, "deleted_by")
                else [
                    "is_deleted",
                    "status",
                    "deleted_at",
                ]
            )
        )

        return instance

    @classmethod
    def restore(cls, instance):
        instance.is_deleted = False
        instance.status = RecordStatus.ACTIVE
        instance.deleted_at = None

        if hasattr(instance, "deleted_by"):
            instance.deleted_by = None

        instance.save(
            update_fields=(
                [
                    "is_deleted",
                    "status",
                    "deleted_at",
                    "deleted_by",
                ]
                if hasattr(instance, "deleted_by")
                else [
                    "is_deleted",
                    "status",
                    "deleted_at",
                ]
            )
        )

        return instance

    @classmethod
    def hard_delete(cls, instance):
        instance.delete()
