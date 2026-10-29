"""``GET <entity>/{id}/status-history/``: the append-only status changes of one record."""

from __future__ import annotations

from drf_spectacular.utils import extend_schema
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.production.api.serializers.status_history import StatusHistorySerializer
from apps.production.selectors.status_history import StatusHistorySelector


class StatusHistoryMixin:
    @extend_schema(responses=StatusHistorySerializer(many=True))
    @action(detail=True, methods=["get"], url_path="status-history")
    def status_history(self, request, *args, **kwargs):
        instance = self.get_object()  # pyright: ignore[reportAttributeAccessIssue]
        rows = StatusHistorySelector.for_entity(instance, request=request)
        return Response(StatusHistorySerializer(rows, many=True).data)
