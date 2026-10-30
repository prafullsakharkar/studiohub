"""
Tag API viewsets.
"""

from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied

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
from apps.identity.permissions import HasPermission

# Tags are platform reference data (ADR-0033 D3): anyone signed in reads them, and administering them is
# platform settings administration, so the existing code is reused instead of a new one nobody holds.
TAG_MANAGE = "settings.manage"


class TagViewSet(ResponseEnvelopeMixin, viewsets.ModelViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """
    ViewSet for Tag management.
    """

    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    lookup_field = "id"
    lookup_url_kwarg = "uuid"
    pagination_class = BasePagination
    permission_classes = (IsAuthenticatedPermission, HasPermission)

    permission_map = {
        "list": (),
        "retrieve": (),
        "create": (TAG_MANAGE,),
        "update": (TAG_MANAGE,),
        "partial_update": (TAG_MANAGE,),
        "destroy": (TAG_MANAGE,),
    }

    search_fields = (
        "name",
        "description",
    )

    filterset_fields = (
        "is_system",
    )

    resource_name = "Tag"

    def get_permission_required(self):
        """The codes ``HasPermission`` asks for; ``None`` (deny) for an action without an entry."""
        action = getattr(self, "action", None)
        if not action:
            return ()
        return self.permission_map.get(action)

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

    def _guard_system_tag(self, instance):
        # System tags belong to the platform: only a platform administrator may change or remove one.
        if instance.is_system and not getattr(self.request.user, "is_superuser", False):
            raise PermissionDenied("System tags cannot be changed.")

    def perform_update(self, serializer):
        self._guard_system_tag(serializer.instance)
        super().perform_update(serializer)

    def perform_destroy(self, instance):
        self._guard_system_tag(instance)
        super().perform_destroy(instance)
