from django.db import transaction
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.api.pagination import StandardPagination
from apps.production.api.filtersets.version import VersionFilterSet
from apps.production.api.serializers.actions import (
    AddToPlaylistSerializer,
    PublishVersionSerializer,
    validated,
)
from apps.production.api.serializers.version.create import VersionCreateSerializer
from apps.production.api.serializers.version.detail import VersionDetailSerializer
from apps.production.api.serializers.version.list import VersionListSerializer
from apps.production.api.serializers.version.update import VersionUpdateSerializer
from apps.production.api.viewsets.base import ProductionEntityViewSet
from apps.production.constants.permissions import PlaylistPermissions, VersionPermissions
from apps.production.models import Asset, Playlist, Shot, Task
from apps.production.selectors.version import VersionSelector
from apps.production.services.version import VersionService
from apps.production.validators.references import require_project_member, resolve_in_project


class VersionViewSet(ProductionEntityViewSet):  # pyright: ignore[reportMissingTypeArgument]
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
        "add_to_playlist": (VersionPermissions.UPDATE, PlaylistPermissions.UPDATE),
        "archived": (VersionPermissions.VIEW,),
        "restore": (VersionPermissions.UPDATE,),
    }

    # Setting a version to Approved with a plain update is publishing it.
    privileged_values = {"status": {"Approved": VersionPermissions.PUBLISH}}

    search_fields = ("code", "version_number", "entity_code")
    ordering_fields = ("code", "created_at", "version_number")

    def validate_references(self, project, data, instance=None):
        """Shot, asset, task and artist must belong to the version's own project."""
        if project is None:
            return
        for field, model in (("shot", Shot), ("asset", Asset), ("task", Task)):
            if data.get(field) is not None:
                resolve_in_project(model, project, data[field], field=field)
        require_project_member(project, data.get("artist"), field="artist", label="artist")

    @extend_schema(request=PublishVersionSerializer)
    @action(detail=True, methods=["post"], url_path="publish")
    def publish(self, request, *args, **kwargs):
        instance = self.get_object()
        info = validated(PublishVersionSerializer, request.data)["publishing_info"]
        publishing_info = {**(instance.publishing_info or {}), **info}
        publishing_info["published_at"] = publishing_info.get("published_at") or timezone.now().isoformat()
        instance.is_published = True
        instance.publishing_info = publishing_info
        instance.save(update_fields=["is_published", "publishing_info"])
        return Response(VersionDetailSerializer(instance).data)

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

    @extend_schema(request=AddToPlaylistSerializer)
    @action(detail=True, methods=["post"], url_path="add-to-playlist")
    def add_to_playlist(self, request, *args, **kwargs):
        instance = self.get_object()
        body = validated(AddToPlaylistSerializer, request.data)
        playlist_id = body.get("playlist_id")
        # The playlist must belong to the version's project; a playlist of another
        # project fails like an unknown id. Nothing is written when it does.
        playlist = (
            resolve_in_project(Playlist, instance.project, playlist_id, field="playlist_id", label="playlist")
            if playlist_id
            else None
        )
        with transaction.atomic():
            instance.playlists = [
                *(instance.playlists or []),
                {"playlist_id": str(playlist_id) if playlist_id else None, "playlist_name": body.get("playlist_name", "")},
            ]
            instance.save(update_fields=["playlists"])
            if playlist is not None:
                playlist.entries = [
                    *(playlist.entries or []),
                    {"version_id": str(instance.id), "version_number": instance.version_number},
                ]
                playlist.save(update_fields=["entries"])
        return Response(VersionDetailSerializer(instance).data)
