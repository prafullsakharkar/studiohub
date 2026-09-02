from apps.production.api.serializers.media.create import MediaCreateSerializer
from apps.production.api.serializers.media.detail import MediaDetailSerializer
from apps.production.api.serializers.media.list import MediaListSerializer
from apps.production.api.serializers.media.update import MediaUpdateSerializer
from apps.production.api.viewsets.base import ProductionEntityViewSet
from apps.production.constants.permissions import MediaPermissions
from apps.production.selectors.media import MediaSelector
from apps.production.services.media import MediaService


class MediaViewSet(ProductionEntityViewSet):
    selector_class = MediaSelector
    service_class = MediaService
    pagination_class = None
    serializer_map = {
        "list": MediaListSerializer,
        "retrieve": MediaDetailSerializer,
        "create": MediaCreateSerializer,
        "update": MediaUpdateSerializer,
        "partial_update": MediaUpdateSerializer,
    }

    permission_map = {
        "list": (MediaPermissions.VIEW,),
        "retrieve": (MediaPermissions.VIEW,),
        "create": (MediaPermissions.CREATE,),
        "update": (MediaPermissions.UPDATE,),
        "partial_update": (MediaPermissions.UPDATE,),
        "destroy": (MediaPermissions.DELETE,),
    }

    search_fields = ("category",)
    filterset_fields = ("media_type", "project", "entity_type", "entity_id")
    ordering_fields = ("created_at",)
