from apps.core.api.pagination import StandardPagination
from apps.production.api.filtersets.editorial_track import EditorialTrackFilterSet
from apps.production.api.serializers.track.create import TrackCreateSerializer
from apps.production.api.serializers.track.detail import TrackDetailSerializer
from apps.production.api.serializers.track.list import TrackListSerializer
from apps.production.api.serializers.track.update import TrackUpdateSerializer
from apps.production.api.viewsets.base import ProductionEntityViewSet
from apps.production.constants.permissions import EditorialTrackPermissions
from apps.production.selectors.editorial_track import EditorialTrackSelector
from apps.production.services.editorial_track import EditorialTrackService


class EditorialTrackViewSet(ProductionEntityViewSet):  # pyright: ignore[reportMissingTypeArgument]
    """Flat CRUD for NLE timeline tracks (frontend TracksPage)."""

    selector_class = EditorialTrackSelector
    service_class = EditorialTrackService
    pagination_class = StandardPagination
    filterset_class = EditorialTrackFilterSet

    serializer_map = {
        "list": TrackListSerializer,
        "retrieve": TrackDetailSerializer,
        "create": TrackCreateSerializer,
        "update": TrackUpdateSerializer,
        "partial_update": TrackUpdateSerializer,
    }

    permission_map = {
        "list": (EditorialTrackPermissions.VIEW,),
        "retrieve": (EditorialTrackPermissions.VIEW,),
        "create": (EditorialTrackPermissions.CREATE,),
        "update": (EditorialTrackPermissions.UPDATE,),
        "partial_update": (EditorialTrackPermissions.UPDATE,),
        "destroy": (EditorialTrackPermissions.DELETE,),
    }

    search_fields = ("name", "track_type", "status", "cut_name")
    ordering_fields = ("track_number", "name", "created_at", "status")

    def create(self, request, *args, **kwargs):
        # Respond with the full detail shape (project_code etc.), not the
        # write shape — the UI renders the created row immediately.
        from rest_framework.response import Response

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        output = TrackDetailSerializer(
            serializer.instance, context=self.get_serializer_context()
        )
        headers = self.get_success_headers(output.data)
        return Response(output.data, status=201, headers=headers)
