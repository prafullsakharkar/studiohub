"""``POST <shots|assets>/{id}/rename-code/``: the deliberate rename of a frozen code."""

from __future__ import annotations

from drf_spectacular.utils import extend_schema
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.production.api.serializers.actions import RenameCodeSerializer, validated
from apps.production.services.codes import CodeService


class RenameCodeMixin:
    @extend_schema(request=RenameCodeSerializer)
    @action(detail=True, methods=["post"], url_path="rename-code")
    def rename_code(self, request, *args, **kwargs):
        instance = self.get_object()  # pyright: ignore[reportAttributeAccessIssue]
        body = validated(RenameCodeSerializer, request.data)
        CodeService.rename_code(actor=request.user, entity=instance, new_code=body["code"])
        return Response(self.get_serializer(instance).data)  # pyright: ignore[reportAttributeAccessIssue]
