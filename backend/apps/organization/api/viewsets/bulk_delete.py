"""
Bulk delete action for organization entity viewsets.

Attach to any ``OrganizationEntityViewSet`` subclass to expose
``POST <collection>/bulk-delete/`` with body ``{"ids": [<uuid>, ...]}``.
Each id is resolved inside the request's organization scope (fail closed:
unknown or foreign ids report ``not_found`` and are never touched) and
deleted through the configured service. Response envelope::

    {"processed": N, "successful": M, "failed": K,
     "results": [{"id": <uuid>, "status": "deleted|not_found|invalid"}]}
"""

from __future__ import annotations

from typing import Any, ClassVar

from rest_framework import serializers
from rest_framework.decorators import action
from rest_framework.response import Response


class BulkDeleteMixin:
    """
    Bulk soft-delete for org entities. The viewset must define
    ``service_class`` (with ``delete(instance)``) and list this action in
    ``permission_map`` as ``"bulk_delete"`` (fail closed when absent).
    """

    service_class: ClassVar[Any]
    request: ClassVar[Any]
    filter_queryset: ClassVar[Any]
    get_queryset: ClassVar[Any]
    check_object_permissions: ClassVar[Any]

    @action(detail=False, methods=["post"], url_path="bulk-delete")
    def bulk_delete(self, request, **kwargs):
        ids = request.data.get("ids", []) if isinstance(request.data, dict) else []
        if not isinstance(ids, list):
            raise serializers.ValidationError({"ids": "Expected a list of ids."})
        ids = [str(i) for i in ids[:100]]

        queryset = self.filter_queryset(self.get_queryset())
        results = []
        for item_id in ids:
            try:
                instance = queryset.filter(id=item_id).first()
            except (ValueError, TypeError):
                instance = None
            if instance is None:
                results.append({"id": item_id, "status": "not_found"})
                continue
            self.check_object_permissions(self.request, instance)
            self.get_service().delete(instance, user=self.request.user)
            results.append({"id": item_id, "status": "deleted"})

        successful = sum(1 for r in results if r["status"] == "deleted")
        return Response(
            {
                "processed": len(results),
                "successful": successful,
                "failed": len(results) - successful,
                "results": results,
            }
        )

    def get_service(self):
        if self.service_class is None:
            raise NotImplementedError("service_class must be defined.")
        return self.service_class
