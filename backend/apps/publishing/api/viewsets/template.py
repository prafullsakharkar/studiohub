"""
Path template endpoints (review-pipeline RP-4, C-RP-18).

List, read, create and change. No delete: a template is retired with ``is_active``. PUT is not
offered; PATCH changes the fields it names.
"""

from __future__ import annotations

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.response import Response

from apps.core.api.pagination import StandardPagination
from apps.core.api.viewsets.platform_crud import PlatformReadViewSet
from apps.core.permissions.base import IsAuthenticatedPermission
from apps.identity.permissions import HasPermission
from apps.publishing.api.serializers.template import (
    PathTemplateCreateSerializer,
    PathTemplateSerializer,
    PathTemplateUpdateSerializer,
)
from apps.publishing.constants.permissions import PublishPermissions
from apps.publishing.selectors.templates import PathTemplateSelector
from apps.publishing.services.templates import PathTemplateService


class PathTemplateViewSet(PlatformReadViewSet):  # pyright: ignore[reportMissingTypeArgument]
    selector_class = PathTemplateSelector
    pagination_class = StandardPagination
    permission_classes = (IsAuthenticatedPermission, HasPermission)
    http_method_names = ["get", "post", "patch", "head", "options"]
    serializer_map = {
        "list": PathTemplateSerializer,
        "retrieve": PathTemplateSerializer,
        "create": PathTemplateCreateSerializer,
        "partial_update": PathTemplateUpdateSerializer,
    }
    permission_map = {
        "list": (PublishPermissions.VIEW,),
        "retrieve": (PublishPermissions.VIEW,),
        "create": (PublishPermissions.TEMPLATE_MANAGE,),
        "partial_update": (PublishPermissions.TEMPLATE_MANAGE,),
    }
    ordering_fields = ("created_at", "role")

    def _present(self, template):
        return PathTemplateSerializer(template, context=self.get_serializer_context()).data

    @extend_schema(request=PathTemplateCreateSerializer, responses={201: PathTemplateSerializer})
    def create(self, request, *args, **kwargs):
        body = PathTemplateCreateSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        template = PathTemplateService.create(
            actor=request.user, request=request, data=body.validated_data
        )
        return Response(self._present(template), status=status.HTTP_201_CREATED)

    @extend_schema(request=PathTemplateUpdateSerializer, responses={200: PathTemplateSerializer})
    def partial_update(self, request, *args, **kwargs):
        body = PathTemplateUpdateSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        template = PathTemplateService.update(
            actor=request.user,
            request=request,
            template=self.get_object(),
            data=body.validated_data,
        )
        return Response(self._present(template))
