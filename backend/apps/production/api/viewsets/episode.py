from apps.core.api.mixins.bulk import BulkActionsMixin
from apps.core.api.pagination import StandardPagination
from apps.production.api.filtersets.episode import EpisodeFilterSet
from apps.production.api.serializers.episode.create import EpisodeCreateSerializer
from apps.production.api.serializers.episode.detail import EpisodeDetailSerializer
from apps.production.api.serializers.episode.list import EpisodeListSerializer
from apps.production.api.serializers.episode.update import EpisodeUpdateSerializer
from apps.production.api.viewsets.base import ProductionEntityViewSet
from apps.production.constants.permissions import EpisodePermissions
from apps.production.selectors.episode import EpisodeSelector
from apps.production.services.episode import EpisodeService


class EpisodeViewSet(BulkActionsMixin, ProductionEntityViewSet):  # pyright: ignore[reportMissingTypeArgument]
    selector_class = EpisodeSelector
    service_class = EpisodeService
    pagination_class = StandardPagination
    filterset_class = EpisodeFilterSet
    detail_serializer_class = EpisodeDetailSerializer

    serializer_map = {
        "list": EpisodeListSerializer,
        "retrieve": EpisodeDetailSerializer,
        "create": EpisodeCreateSerializer,
        "update": EpisodeUpdateSerializer,
        "partial_update": EpisodeUpdateSerializer,
    }

    permission_map = {
        "list": (EpisodePermissions.VIEW,),
        "retrieve": (EpisodePermissions.VIEW,),
        "create": (EpisodePermissions.CREATE,),
        "update": (EpisodePermissions.UPDATE,),
        "partial_update": (EpisodePermissions.UPDATE,),
        "destroy": (EpisodePermissions.DELETE,),
        "bulk_create": (EpisodePermissions.CREATE,),
        "bulk_update": (EpisodePermissions.UPDATE,),
        "bulk_archive": (EpisodePermissions.DELETE,),
        "bulk_restore": (EpisodePermissions.UPDATE,),
        "check_existence": (EpisodePermissions.CREATE,),
        "existence_check": (EpisodePermissions.CREATE,),
        "archive": (EpisodePermissions.DELETE,),
        "restore": (EpisodePermissions.UPDATE,),
        "archived": (EpisodePermissions.VIEW,),
    }

    search_fields = ("code", "name", "description")
    ordering_fields = ("code", "name", "season_number", "episode_number", "created_at", "status")
