"""
Sequence service.

Extends ``BulkOperationService`` (bulk existence check, bulk create/update/
archive/restore with per-item partial-failure reporting) on top of the
canonical ``BusinessService`` (create/update/soft-delete/restore).
Bulk operations are organization scoped and fail closed so the client can
reconcile (e.g. prompt to restore a soft-deleted row).

Soft-delete is the recoverable "archive" mechanism (see AGENTS soft-delete
rule): ``bulk_archive`` soft-deletes, ``bulk_restore`` un-deletes.
"""

from __future__ import annotations

from apps.production.api.serializers.sequence.update import SequenceUpdateSerializer
from apps.production.models import Sequence
from apps.production.services.bulk import BulkOperationService


class SequenceService(BulkOperationService):
    model = Sequence
    bulk_update_serializer = SequenceUpdateSerializer

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
