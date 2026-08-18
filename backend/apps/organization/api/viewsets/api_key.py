from apps.organization.api.filtersets.api_key import APIKeyFilterSet
from apps.organization.api.serializers.api_key import (
    APIKeyCreateSerializer,
    APIKeyDetailSerializer,
    APIKeyListSerializer,
    APIKeyUpdateSerializer,
)
from apps.organization.api.viewsets.base import OrganizationEntityViewSet
from apps.organization.constants.permissions import APIKeyPermissions
from apps.organization.models.api_key import APIKey
from apps.organization.selectors.api_key import APIKeySelector
from apps.organization.services.api_key import APIKeyService


class APIKeyViewSet(OrganizationEntityViewSet):
    """
    API endpoint for APIKey.
    """

    queryset = APIKey.objects.all()

    selector_class = APIKeySelector
    service_class = APIKeyService

    search_fields = (
        "name",
        "description",
    )

    filterset_class = APIKeyFilterSet

    serializer_map = {
        "list": APIKeyListSerializer,
        "retrieve": APIKeyDetailSerializer,
        "create": APIKeyCreateSerializer,
        "update": APIKeyUpdateSerializer,
        "partial_update": APIKeyUpdateSerializer,
    }

    permission_map = {
        "list": (APIKeyPermissions.VIEW,),
        "retrieve": (APIKeyPermissions.VIEW,),
        "create": (APIKeyPermissions.CREATE,),
        "update": (APIKeyPermissions.UPDATE,),
        "partial_update": (APIKeyPermissions.UPDATE,),
        "destroy": (APIKeyPermissions.DELETE,),
    }
