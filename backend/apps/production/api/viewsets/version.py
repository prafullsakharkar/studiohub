from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.api.pagination import StandardPagination
from apps.production.api.filtersets.version import VersionFilterSet
from apps.production.api.serializers.version.create import VersionCreateSerializer
from apps.production.api.serializers.version.detail import VersionDetailSerializer
from apps.production.api.serializers.version.list import VersionListSerializer
from apps.production.api.serializers.version.update import VersionUpdateSerializer
from apps.production.api.viewsets.base import ProductionEntityViewSet
from apps.production.constants.permissions import VersionPermissions
from apps.production.selectors.version import VersionSelector
from apps.production.services.version import VersionService


class VersionViewSet(ProductionEntityViewSet):
    selector_class = VersionSelector
    service_class = VersionService
    pagination_class = StandardPagination
    filterset_class = VersionFilterSet
    serializer_map = {
        "list": VersionListSerializer,
        "retrieve": VersionDetailSerializer,
        "create": VersionCreateSerializer,
        "update": VersionUpdateSerializer,
        "partial_update": VersionUpdateSerializer,
    }

    permission_map = {
        "list": (VersionPermissions.VIEW,),
        "retrieve": (VersionPermissions.VIEW,),
        "create": (VersionPermissions.CREATE,),
        "update": (VersionPermissions.UPDATE,),
        "partial_update": (VersionPermissions.UPDATE,),
        "destroy": (VersionPermissions.DELETE,),
        "publish": (VersionPermissions.PUBLISH,),
        "unpublish": (VersionPermissions.PUBLISH,),
        "archive": (VersionPermissions.UPDATE,),
        "promote": (VersionPermissions.PUBLISH,),
        "add_to_playlist": (VersionPermissions.UPDATE,),
    }

    search_fields = ("code", "version_number", "entity_code")
    ordering_fields = ("code", "created_at", "version_number")

    @action(detail=True, methods=["post"], url_path="publish")
    def publish(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_published = True
        # Merge publishing_info from request if provided
        info = request.data.get("publishing_info") or request.data
        if isinstance(info, dict):
            # Ensure publishing_info has required fields
            pi = instance.publishing_info or {}
            pi.update({k: v for k, v in info.items() if k not in ("id",)})
            # Add publisher info
            pi["published_at"] = pi.get("published_at") or __import__("django.utils.timezone", fromlist=["now"]).now().isoformat()
            instance.publishing_info = pi
        instance.save(update_fields=["is_published", "publishing_info"])
        serializer = VersionDetailSerializer(instance)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="unpublish")
    def unpublish(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_published = False
        instance.save(update_fields=["is_published"])
        serializer = VersionDetailSerializer(instance)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="archive")
    def archive(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_archived = True
        instance.save(update_fields=["is_archived"])
        serializer = VersionDetailSerializer(instance)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="promote")
    def promote(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_hero = True
        instance.status = "Approved"
        instance.save(update_fields=["is_hero", "status"])
        serializer = VersionDetailSerializer(instance)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="add-to-playlist")
    def add_to_playlist(self, request, *args, **kwargs):
        instance = self.get_object()
        playlist_id = request.data.get("playlist_id")
        playlist_name = request.data.get("playlist_name", "")
        # Minimal: just record in version's playlists JSON
        playlists = instance.playlists or []
        playlists.append({"playlist_id": playlist_id, "playlist_name": playlist_name})
        instance.playlists = playlists
        instance.save(update_fields=["playlists"])
        # Also try to update Playlist model if exists
        if playlist_id:
            from apps.production.models import Playlist
            try:
                pl = Playlist.objects.get(pk=playlist_id)
                entries = pl.entries or []
                entries.append({"version_id": str(instance.id), "version_number": instance.version_number})
                pl.entries = entries
                pl.save(update_fields=["entries"])
            except Exception:
                pass
        serializer = VersionDetailSerializer(instance)
        return Response(serializer.data)
