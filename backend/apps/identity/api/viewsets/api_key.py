from apps.identity.api.filtersets import APIKeyFilterSet
from apps.identity.api.serializers.api_key import (
    APIKeyCreateSerializer,
    APIKeyDetailSerializer,
    APIKeyListSerializer,
    APIKeyUpdateSerializer,
)
from apps.identity.models import APIKey
from apps.identity.permissions.api_key import (
    APIKeyPermissions,
)
from apps.identity.selectors import APIKeySelector
from apps.identity.services import APIKeyService

from .base import IdentityViewSet


class APIKeyViewSet(
    IdentityViewSet,
):

    queryset = APIKey.objects.none()

    selector_class = APIKeySelector

    service_class = APIKeyService

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
