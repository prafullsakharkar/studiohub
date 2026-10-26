import uuid

from drf_spectacular.utils import extend_schema
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.core.api.pagination import StandardPagination
from apps.production.api.serializers.actions import (
    AddEntrySerializer,
    RemoveEntrySerializer,
    ReorderEntriesSerializer,
    ShareSettingsSerializer,
    validated,
)
from apps.production.api.serializers.playlist.create import PlaylistCreateSerializer
from apps.production.api.serializers.playlist.detail import PlaylistDetailSerializer
from apps.production.api.serializers.playlist.list import PlaylistListSerializer
from apps.production.api.serializers.playlist.update import PlaylistUpdateSerializer
from apps.production.api.viewsets.base import ProductionEntityViewSet
from apps.production.constants.permissions import PlaylistPermissions
from apps.production.models import Version
from apps.production.selectors.playlist import PlaylistSelector
from apps.production.services.playlist import PlaylistService
from apps.production.validators.references import resolve_in_project


class PlaylistViewSet(ProductionEntityViewSet):  # pyright: ignore[reportMissingTypeArgument]
    selector_class = PlaylistSelector
    service_class = PlaylistService
    # Frontend contract: paginated list (BaseRepository expects PaginatedResponse).
    pagination_class = StandardPagination
    serializer_map = {
        "list": PlaylistListSerializer,
        "retrieve": PlaylistDetailSerializer,
        "create": PlaylistCreateSerializer,
        "update": PlaylistUpdateSerializer,
        "partial_update": PlaylistUpdateSerializer,
    }

    permission_map = {
        "list": (PlaylistPermissions.VIEW,),
        "retrieve": (PlaylistPermissions.VIEW,),
        "create": (PlaylistPermissions.CREATE,),
        "update": (PlaylistPermissions.UPDATE,),
        "partial_update": (PlaylistPermissions.UPDATE,),
        "destroy": (PlaylistPermissions.DELETE,),
        "add_entry": (PlaylistPermissions.UPDATE,),
        "remove_entry": (PlaylistPermissions.UPDATE,),
        "reorder": (PlaylistPermissions.UPDATE,),
        "share": (PlaylistPermissions.UPDATE,),
        "archive": (PlaylistPermissions.UPDATE,),
        "restore": (PlaylistPermissions.UPDATE,),
        "archived": (PlaylistPermissions.VIEW,),
    }

    search_fields = ("name", "code")
    filterset_fields = ("status", "project", "client_only")
    ordering_fields = ("name", "created_at")

    @extend_schema(request=AddEntrySerializer)
    @action(detail=True, methods=["post"], url_path="add-entry")
    def add_entry(self, request, *args, **kwargs):
        instance = self.get_object()
        body = validated(AddEntrySerializer, request.data)
        if body.get("version_id"):
            # A playlist only lists versions of its own project.
            resolve_in_project(Version, instance.project, body["version_id"], field="version_id", label="version")
        entries = instance.entries or []
        entry = {
            **body,
            "version_id": str(body["version_id"]) if body.get("version_id") else None,
            "id": str(uuid.uuid4()),
            "item_order": len(entries) + 1,
        }
        instance.entries = [*entries, entry]
        instance.save(update_fields=["entries"])
        return Response(PlaylistDetailSerializer(instance).data)

    @extend_schema(request=RemoveEntrySerializer)
    @action(detail=True, methods=["post"], url_path="remove-entry")
    def remove_entry(self, request, *args, **kwargs):
        instance = self.get_object()
        entry_id = validated(RemoveEntrySerializer, request.data)["entry_id"]
        instance.entries = [e for e in (instance.entries or []) if e.get("id") != entry_id and e.get("entry_id") != entry_id]
        instance.save(update_fields=["entries"])
        return Response(PlaylistDetailSerializer(instance).data)

    @extend_schema(request=ReorderEntriesSerializer)
    @action(detail=True, methods=["post"], url_path="reorder")
    def reorder(self, request, *args, **kwargs):
        instance = self.get_object()
        entries = validated(ReorderEntriesSerializer, request.data).get("entries")
        if entries is not None:
            # Reordering only arranges entries the playlist already has; it
            # cannot introduce new ones (or versions of other projects).
            stored = {str(entry.get("id")): entry for entry in instance.entries or []}
            ordered = []
            for position, item in enumerate(entries, start=1):
                entry = stored.get(str(item.get("id")))
                if entry is None:
                    raise ValidationError({"entries": ["Unknown entry."]})
                ordered.append({**entry, "item_order": position})
            instance.entries = ordered
            instance.save(update_fields=["entries"])
        return Response(PlaylistDetailSerializer(instance).data)

    @extend_schema(request=ShareSettingsSerializer)
    @action(detail=True, methods=["post"], url_path="share")
    def share(self, request, *args, **kwargs):
        instance = self.get_object()
        # Merge share_settings
        instance.share_settings = {**(instance.share_settings or {}), **validated(ShareSettingsSerializer, request.data)}
        instance.save(update_fields=["share_settings"])
        return Response(PlaylistDetailSerializer(instance).data)

    def after_archive(self, instance):
        instance.status = "Archived"
        instance.save(update_fields=["status"])

    def after_restore(self, instance):
        instance.status = "Active"
        instance.save(update_fields=["status"])
