"""
Sequence service.

Extends ``BulkOperationService`` (bulk existence check, bulk create/update/
archive/restore with per-item partial-failure reporting) on top of the
canonical ``BusinessService`` (create/update/soft-delete/restore).
Bulk operations are project scoped and fail closed so the client can
reconcile (e.g. prompt to restore a soft-deleted row).

Soft-delete is the recoverable "archive" mechanism (see AGENTS soft-delete
rule): ``bulk_archive`` soft-deletes, ``bulk_restore`` un-deletes.
"""

from __future__ import annotations

from apps.production.models import Sequence
from apps.production.services.bulk import BulkOperationService
from apps.production.validators.hierarchy import ensure_no_live_children


class SequenceService(BulkOperationService):
    model = Sequence

    # Result statuses (inherited from BulkOperationService; repeated here so
    # existing imports like ``SequenceService.CREATED`` keep working).
    NEW = BulkOperationService.NEW
    CREATED = BulkOperationService.CREATED
    EXISTS = BulkOperationService.EXISTS
    SOFT_DELETED = BulkOperationService.SOFT_DELETED
    DUPLICATE = BulkOperationService.DUPLICATE
    INVALID = BulkOperationService.INVALID
    UPDATED = BulkOperationService.UPDATED
    ARCHIVED = BulkOperationService.ARCHIVED
    RESTORED = BulkOperationService.RESTORED
    NOT_FOUND = BulkOperationService.NOT_FOUND

    @classmethod
    def before_delete(cls, instance, **kwargs):
        ensure_no_live_children(instance)
        return instance

    @classmethod
    def after_update(cls, instance, **kwargs):
        """
        A renamed sequence keeps its shots: their text copy of the code follows. A
        sequence moved to another episode takes its shots along (D-12).
        """
        from apps.production.models import Shot

        shots = Shot.all_objects.filter(sequence=instance)
        shots.exclude(sequence_code=instance.code).update(sequence_code=instance.code)
        if instance.episode_id is not None:
            shots.exclude(episode_id=instance.episode_id).update(episode_id=instance.episode_id)
        return instance
