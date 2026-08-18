"""
Import ViewSets.

This module provides ViewSets with import functionality.
"""
from __future__ import annotations

from rest_framework import mixins

from ..mixins.import_mixin import ImportMixin
from .base import BaseViewSet


class ImportModelViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    ImportMixin,
    BaseViewSet,
):
    """
    Base ViewSet with import functionality.

    Provides:
    - Full CRUD operations
    - Import via `import_data` action
    """

    lookup_field = "id"
    lookup_url_kwarg = "uuid"
