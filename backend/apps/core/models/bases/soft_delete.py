"""
Soft delete base model.
"""

from __future__ import annotations

from django.db import models

from apps.core.models.managers import (
    AllObjectsManager,
    SoftDeleteManager,
)


class SoftDeleteModel(models.Model):
    """
    Abstract model implementing soft delete support.

    Provides:
    - is_deleted flag for soft deletion
    - deleted_at timestamp
    - deleted_by reference (if AuditModel is also inherited)

    Note: Does NOT provide 'status' field to avoid conflict with LifecycleModel.
    Use LifecycleModel for status-based workflows, or define your own status
    field in the domain model if needed.
    """

    is_deleted = models.BooleanField(
        default=False,
        db_index=True,
    )

    deleted_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
    )

    objects = SoftDeleteManager()

    all_objects = AllObjectsManager()

    class Meta:
        abstract = True
        # The base manager includes deleted records so that refresh_from_db()
        # (and forward FK resolution) can still reach soft-deleted rows.
        base_manager_name = "all_objects"

    def delete(self, *args, **kwargs):
        """
        Soft-delete the record by default.

        The record is flagged ``is_deleted`` and kept in the database,
        retrievable via ``all_objects``. Use ``hard_delete()`` for a real
        database delete.
        """
        from apps.core.services import SoftDeleteService

        user = kwargs.pop("user", None)
        if self.is_deleted:
            return
        SoftDeleteService.delete(self, user=user)
