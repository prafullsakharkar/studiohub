"""
Tag API viewsets.
"""

from rest_framework import viewsets

from apps.core.api.mixins.response import ResponseEnvelopeMixin
from apps.core.api.pagination.base import BasePagination
from apps.core.api.serializers.tag import (
    TagCreateSerializer,
    TagDetailSerializer,
    TagListSerializer,
    TagSerializer,
    TagUpdateSerializer,
)
from apps.core.models.tag import Tag
from apps.core.permissions.base import IsAuthenticatedPermission


class TagViewSet(ResponseEnvelopeMixin, viewsets.ModelViewSet):
    """
    ViewSet for Tag management.
    """

    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    lookup_field = "id"
    lookup_url_kwarg = "uuid"
    pagination_class = BasePagination
    permission_classes = (IsAuthenticatedPermission,)

    search_fields = (
        "name",
        "description",
    )

    filterset_fields = (
        "is_system",
    )

    resource_name = "Tag"

    def get_serializer_class(self):
        if self.action == "list":
            return TagListSerializer
        elif self.action == "retrieve":
            return TagDetailSerializer
        elif self.action in ["create"]:
            return TagCreateSerializer
        elif self.action in ["update", "partial_update"]:
            return TagUpdateSerializer
        return super().get_serializer_class()

    def get_queryset(self):
        queryset = super().get_queryset()
        # For now, return all tags since the model doesn't have organization field
        # Organization filtering will be added when the model is updated
        return queryset
