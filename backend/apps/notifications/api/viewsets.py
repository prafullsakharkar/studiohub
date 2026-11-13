"""
The inbox routes (docs/review-pipeline RP-6, C-RP-23).

Any signed-in caller, on their own rows only; another person's row, and a row whose target they
can no longer open, is a 404. No permission code: what a row may show is decided by the target's
own view code and narrowing, under the scopes of an API key or token when one is used.
"""

from __future__ import annotations

from typing import Any, cast

from django.http import Http404
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.api.pagination import StandardPagination
from apps.core.permissions.base import IsAuthenticatedPermission
from apps.notifications.api.serializers import (
    NotificationSerializer,
    ReadAllResultSerializer,
    ReadAllSerializer,
    UnreadCountSerializer,
)
from apps.notifications.constants import Kind
from apps.notifications.selectors.inbox import InboxSelector
from apps.notifications.services.inbox import InboxService


class NotificationViewSet(viewsets.GenericViewSet):  # pyright: ignore[reportMissingTypeArgument]
    permission_classes = (IsAuthenticatedPermission,)
    pagination_class = StandardPagination
    serializer_class = NotificationSerializer
    lookup_value_regex = "[0-9a-fA-F-]{36}"

    def get_queryset(self):
        return InboxSelector.visible(self.request)

    def _row(self, pk):
        row = self.get_queryset().filter(pk=pk).first()
        if row is None:
            raise Http404("Notification not found.")
        return row

    def _present(self, row):
        return NotificationSerializer(row, context=self.get_serializer_context()).data

    @extend_schema(
        parameters=[
            OpenApiParameter("unread", bool, required=False),
            OpenApiParameter("project_id", str, required=False),
            OpenApiParameter("kind", str, required=False, enum=Kind.values),
        ],
        responses={200: NotificationSerializer(many=True)},
    )
    def list(self, request, *args, **kwargs):
        rows = InboxSelector.filtered(self.get_queryset(), request.query_params)
        page = cast(list[Any], self.paginate_queryset(rows) or [])
        context = {**self.get_serializer_context(), "labels": InboxSelector.page_labels(page)}
        data = NotificationSerializer(page, many=True, context=context).data
        return self.get_paginated_response(data)

    @extend_schema(responses={200: UnreadCountSerializer})
    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request, *args, **kwargs):
        return Response({"count": self.get_queryset().filter(read_at__isnull=True).count()})

    @extend_schema(request=None, responses={200: NotificationSerializer})
    @action(detail=True, methods=["post"])
    def read(self, request, pk=None, *args, **kwargs):
        return Response(self._present(InboxService.mark(self._row(pk), read=True)))

    @extend_schema(request=None, responses={200: NotificationSerializer})
    @action(detail=True, methods=["post"])
    def unread(self, request, pk=None, *args, **kwargs):
        return Response(self._present(InboxService.mark(self._row(pk), read=False)))

    @extend_schema(request=ReadAllSerializer, responses={200: ReadAllResultSerializer})
    @action(detail=False, methods=["post"], url_path="read-all")
    def read_all(self, request, *args, **kwargs):
        body = ReadAllSerializer(data=request.data or {})
        body.is_valid(raise_exception=True)
        before = cast(dict[str, Any], body.validated_data).get("before")
        return Response({"updated": InboxService.mark_all_read(self.get_queryset(), before=before)})
