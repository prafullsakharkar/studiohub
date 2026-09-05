"""
Delivery destination viewset for API endpoints.
"""
from apps.core.api.pagination import StandardPagination
from apps.core.permissions.base import IsAuthenticatedPermission
from apps.deliveries.api.serializers.destination import (
    DestinationDetailSerializer,
    DestinationListSerializer,
)
from apps.deliveries.constants.permissions import DeliveryPermissions
from apps.deliveries.selectors.destination import DestinationSelector
from apps.identity.permissions import HasPermission
from apps.organization.api.viewsets.scoped import OrganizationScopedViewSet


class DestinationViewSet(OrganizationScopedViewSet):
    """ViewSet for DeliveryDestination."""

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
        "list": (DeliveryPermissions.VIEW,),
        "retrieve": (DeliveryPermissions.VIEW,),
        "create": (DeliveryPermissions.CREATE,),
        "update": (DeliveryPermissions.UPDATE,),
        "partial_update": (DeliveryPermissions.UPDATE,),
        "destroy": (DeliveryPermissions.DELETE,),
    }

    search_fields = ("name", "endpoint", "storage_region")
    ordering_fields = ("name", "created_at")

    def get_perform_create_kwargs(self):
        user = self.request.user
        return {
            "created_by": user if user.is_authenticated else None,
        }
