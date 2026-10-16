"""
Publish destination viewset for API endpoints.
"""
from rest_framework import mixins

from apps.core.api.pagination import StandardPagination
from apps.core.api.viewsets.platform import PlatformScopedViewSet
from apps.core.permissions.base import IsAuthenticatedPermission
from apps.identity.permissions import HasPermission
from apps.publishing.api.serializers.destination import (
    DestinationDetailSerializer,
    DestinationListSerializer,
)
from apps.publishing.constants.permissions import PublishPermissions
from apps.publishing.selectors.destination import DestinationSelector


class PlatformCrudViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    PlatformScopedViewSet,
):
    """Platform-global CRUD (org-free).

    Querysets come from the selector's org-free reads. Destroy honors
    the Core soft-delete contract (same as the former org-scoped base).
    """

    # Same URL contract as the former org-scoped base: ``uuid`` kwarg
    # resolving against the ``id`` primary key.
    lookup_field = "id"
    lookup_url_kwarg = "uuid"

    serializer_map = {}

    def get_serializer_class(self):
        action = getattr(self, "action", None)
        serializer = self.serializer_map.get(action)
        if serializer:
            return serializer
        if self.serializer_map and (action is None or action not in self.serializer_map):
            # Schema generation (drf-spectacular) introspects operations
            # before dispatch (no action set) and for unmapped actions;
            # fall back to the primary mapped serializer so OpenAPI can
            # resolve. Runtime behavior for mapped actions is unchanged.
            preferred = self.serializer_map.get("list")
            return preferred or next(iter(self.serializer_map.values()))
        return super().get_serializer_class()

    def perform_destroy(self, instance):
        from apps.core.services.soft_delete import SoftDeleteService

        if hasattr(instance, "is_deleted"):
            SoftDeleteService.delete(
                instance,
                user=getattr(self.request, "user", None),
            )
        else:
            instance.delete()


class DestinationViewSet(PlatformCrudViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """ViewSet for PublishDestination."""

    selector_class = DestinationSelector
    pagination_class = StandardPagination
    permission_classes = (IsAuthenticatedPermission, HasPermission)

    serializer_map = {
        "list": DestinationListSerializer,
        "retrieve": DestinationDetailSerializer,
        "create": DestinationListSerializer,
        "update": DestinationListSerializer,
        "partial_update": DestinationListSerializer,
    }

    permission_map = {
        "list": (PublishPermissions.VIEW,),
        "retrieve": (PublishPermissions.VIEW,),
        "create": (PublishPermissions.CREATE,),
        "update": (PublishPermissions.UPDATE,),
        "partial_update": (PublishPermissions.UPDATE,),
        "destroy": (PublishPermissions.DELETE,),
    }

    search_fields = ("name", "path", "region")
    ordering_fields = ("name", "created_at")

    def perform_create(self, serializer):
        user = self.request.user
        serializer.save(created_by=user if user.is_authenticated else None)
