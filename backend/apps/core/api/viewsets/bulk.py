"""
Bulk ViewSet support.

Provides mixins and a ViewSet for creating/updating multiple resources
in a single request. Bulk operations are opt-in: applications must
inherit from ``BulkModelViewSet`` (or apply the mixins) and use a
serializer that supports ``many=True`` (e.g. ``BulkModelSerializer``).
"""

from __future__ import annotations

from rest_framework import status
from rest_framework.response import Response

from .generic import BaseModelViewSet


class BulkCreateModelMixin:
    """
    Create multiple instances in a single request.

    Expects a list payload and a serializer that supports ``many=True``.
    """

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, many=True)
        serializer.is_valid(raise_exception=True)
        self.perform_bulk_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED,
            headers=headers,
        )

    def perform_bulk_create(self, serializer):
        serializer.save()


class BulkUpdateModelMixin:
    """
    Update multiple instances in a single request.

    Expects a list payload and a serializer that supports ``many=True``
    and implements ``bulk_update`` on the child serializer.
    """

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(
            queryset,
            data=request.data,
            many=True,
            partial=partial,
        )
        serializer.is_valid(raise_exception=True)
        self.perform_bulk_update(serializer)
        return Response(serializer.data)

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    def perform_bulk_update(self, serializer):
        serializer.save()


class BulkModelViewSet(
    BulkCreateModelMixin,
    BulkUpdateModelMixin,
    BaseModelViewSet,
):
    """
    ViewSet with bulk create/update support.

    Inherits full CRUD from ``BaseModelViewSet`` and adds bulk
    create/update. Use with a ``BulkModelSerializer``.
    """

    pass
