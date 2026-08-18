"""
Bulk ViewSets.

This module provides ViewSets with bulk operations support.
"""
from __future__ import annotations

from rest_framework import mixins

from ..mixins.bulk import BulkOperationsMixin
from .base import BaseViewSet


class BulkModelViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    BulkOperationsMixin,
    BaseViewSet,
):
    """
    Base ViewSet with bulk operations support.

    Provides:
    - Full CRUD operations
    - Bulk create via `bulk_create` action
    - Bulk update via `bulk_update` action
    - Bulk delete via `bulk_delete` action
    """

    lookup_field = "id"
    lookup_url_kwarg = "uuid"
