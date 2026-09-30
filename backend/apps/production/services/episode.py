"""
Episode service.

Extends ``BulkOperationService`` (bulk existence check, bulk create/update/
archive/restore with per-item partial-failure reporting) on top of the
canonical ``BusinessService`` (create/update/soft-delete/restore).
Bulk operations are organization scoped and fail closed so the client can
reconcile (e.g. prompt to restore a soft-deleted row).

Soft-delete is the recoverable "archive" mechanism (see AGENTS soft-delete
rule): ``bulk_archive`` soft-deletes, ``bulk_restore`` un-deletes.
"""

from __future__ import annotations

from apps.production.api.serializers.episode.update import EpisodeUpdateSerializer
from apps.production.models import Episode
from apps.production.services.bulk import BulkOperationService


class EpisodeService(BulkOperationService):
    model = Episode
    bulk_update_serializer = EpisodeUpdateSerializer

    # Result statuses (inherited from BulkOperationService; repeated here so
    # existing imports like ``EpisodeService.CREATED`` keep working).
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
