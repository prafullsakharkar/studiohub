"""
Soft delete behavior mixin.
"""

from __future__ import annotations

from django.utils import timezone

from apps.core.choices import RecordStatus


class SoftDeleteMixin:
    """
    Adds soft delete behaviour to models.
    """

    def soft_delete(self, *, user=None, save=True):
        """
        Soft delete the current instance.
        """

        self.is_deleted = True
        self.status = RecordStatus.DELETED
        self.deleted_at = timezone.now()

        if hasattr(self, "deleted_by"):
            self.deleted_by = user

        if save:
            update_fields = [
                "is_deleted",
                "status",
                "deleted_at",
            ]

            if hasattr(self, "deleted_by"):
                update_fields.append("deleted_by")

            self.save(update_fields=update_fields)

        return self

    def restore(self, *, save=True):
        """
        Restore a soft deleted object.
        """

        self.is_deleted = False
        self.status = RecordStatus.ACTIVE
        self.deleted_at = None

        if hasattr(self, "deleted_by"):
            self.deleted_by = None

        if save:
            update_fields = [
                "is_deleted",
                "status",
                "deleted_at",
            ]

            if hasattr(self, "deleted_by"):
                update_fields.append("deleted_by")

            self.save(update_fields=update_fields)

        return self

    def hard_delete(self, using=None, keep_parents=False):
        """
        Permanently delete the object.
        """

        return super().delete(
            using=using,
            keep_parents=keep_parents,
        )

    def delete(self, using=None, keep_parents=False):
        """
        Override Django delete().

        Calling instance.delete() performs a soft delete.
        """

        self.soft_delete()
