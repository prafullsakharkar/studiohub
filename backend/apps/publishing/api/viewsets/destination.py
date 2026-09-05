"""
Publish destination viewset for API endpoints.
"""
from apps.core.api.pagination import StandardPagination
from apps.core.permissions.base import IsAuthenticatedPermission
from apps.identity.permissions import HasPermission
from apps.organization.api.viewsets.scoped import OrganizationScopedViewSet
from apps.publishing.api.serializers.destination import (
    DestinationDetailSerializer,
    DestinationListSerializer,
)
from apps.publishing.constants.permissions import PublishPermissions
from apps.publishing.selectors.destination import DestinationSelector


class DestinationViewSet(OrganizationScopedViewSet):
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

    def get_perform_create_kwargs(self):
        user = self.request.user
        return {
            "created_by": user if user.is_authenticated else None,
        }
