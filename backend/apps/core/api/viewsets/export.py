"""
Export ViewSets.

This module provides ViewSets with export functionality.
"""
from __future__ import annotations

from rest_framework import mixins

from ..mixins.export import ExportMixin
from .base import BaseViewSet


class ExportModelViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    ExportMixin,
    BaseViewSet,
):
    """
    Base ViewSet with export functionality.

    Provides:
    - Full CRUD operations
    - Export via `export_data` action
    """

    lookup_field = "id"
    lookup_url_kwarg = "uuid"
