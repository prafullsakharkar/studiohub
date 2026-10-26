from django.db import transaction
from drf_spectacular.utils import extend_schema
from rest_framework.decorators import action
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
from apps.production.selectors.playlist import PlaylistSelector
from apps.production.services.playlist import PlaylistService


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

    def perform_create(self, serializer):
        # Entries sent with a new playlist become rows in the same transaction; a version of another
        # project refuses the whole create (no half-made playlist).
        entries = serializer.validated_data.pop("entries", None)
        with transaction.atomic():
            super().perform_create(serializer)
            if entries:
                PlaylistService.add_entries(
                    user=self.request.user, playlist=serializer.instance, entries=entries
                )

    def _detail(self, instance):
        """The playlist as the detail endpoint shows it, with its rows read afresh."""
        return PlaylistDetailSerializer(PlaylistSelector.get_queryset().get(pk=instance.pk)).data

    @extend_schema(request=AddEntrySerializer)
    @action(detail=True, methods=["post"], url_path="add-entry")
    def add_entry(self, request, *args, **kwargs):
        instance = self.get_object()
        body = dict(validated(AddEntrySerializer, request.data))
        # A playlist only lists versions of its own project (checked by the service).
        PlaylistService.add_entry(
            user=request.user,
            playlist=instance,
            version_ref=body.pop("version_id", None),
            extra=body,
        )
        return Response(self._detail(instance))

    @extend_schema(request=RemoveEntrySerializer)
    @action(detail=True, methods=["post"], url_path="remove-entry")
    def remove_entry(self, request, *args, **kwargs):
        instance = self.get_object()
        entry_id = validated(RemoveEntrySerializer, request.data)["entry_id"]
        PlaylistService.remove_entry(user=request.user, playlist=instance, ref=entry_id)
        return Response(self._detail(instance))

    @extend_schema(request=ReorderEntriesSerializer)
    @action(detail=True, methods=["post"], url_path="reorder")
    def reorder(self, request, *args, **kwargs):
        instance = self.get_object()
        entries = validated(ReorderEntriesSerializer, request.data).get("entries")
        if entries is not None:
            # Reordering only arranges entries the playlist already has; it cannot introduce new ones.
            PlaylistService.reorder(
                user=request.user, playlist=instance, ordered_ids=[item.get("id") for item in entries]
            )
        return Response(self._detail(instance))

    @extend_schema(request=ShareSettingsSerializer)
    @action(detail=True, methods=["post"], url_path="share")
    def share(self, request, *args, **kwargs):
        instance = self.get_object()
        # Merge share_settings
        instance.share_settings = {**(instance.share_settings or {}), **validated(ShareSettingsSerializer, request.data)}
        instance.save(update_fields=["share_settings"])
        return Response(self._detail(instance))

    def after_archive(self, instance):
        instance.status = "Archived"
        instance.save(update_fields=["status"])

    def after_restore(self, instance):
        instance.status = "Active"
        instance.save(update_fields=["status"])
