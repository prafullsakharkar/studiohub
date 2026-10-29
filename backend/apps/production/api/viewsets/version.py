from django.db import transaction
from drf_spectacular.utils import extend_schema
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.api.pagination import StandardPagination
from apps.production.api.filtersets.version import VersionFilterSet
from apps.production.api.serializers.actions import (
    AddToPlaylistSerializer,
    PromoteVersionSerializer,
    PublishVersionSerializer,
    validated,
)
from apps.production.api.serializers.version.create import VersionCreateSerializer
from apps.production.api.serializers.version.detail import VersionDetailSerializer
from apps.production.api.serializers.version.list import VersionListSerializer
from apps.production.api.serializers.version.update import VersionUpdateSerializer
from apps.production.api.viewsets.base import ProductionEntityViewSet
from apps.production.api.viewsets.status_history import StatusHistoryMixin
from apps.production.constants.permissions import PlaylistPermissions, VersionPermissions
from apps.production.models import Asset, Playlist, Shot, Task
from apps.production.selectors.version import VersionSelector
from apps.production.services.playlist import PlaylistService
from apps.production.services.version import VersionService
from apps.production.validators.references import require_project_member, resolve_in_project


class VersionViewSet(StatusHistoryMixin, ProductionEntityViewSet):  # pyright: ignore[reportMissingTypeArgument]
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
        "status_history": (VersionPermissions.VIEW,),
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

    search_fields = ("code", "version_number", "entity_code")
    ordering_fields = ("code", "created_at", "version_number")

    #: what a published version may still change (the rest needs it unpublished first)
    EDITABLE_WHEN_PUBLISHED = frozenset({"notes", "tags"})

    def validate_references(self, project, data, instance=None):
        """
        Shot, asset, task and artist must belong to the version's own project; the shot or asset must
        agree with the task's; the entity text, if sent, must agree with the shot or asset (D-29).
        """
        from rest_framework.exceptions import ValidationError

        if project is None:
            return
        for field, model in (("shot", Shot), ("asset", Asset), ("task", Task)):
            if data.get(field) is not None:
                resolve_in_project(model, project, data[field], field=field)
        require_project_member(project, data.get("artist"), field="artist", label="artist")

        shot = data.get("shot", getattr(instance, "shot", None))
        asset = data.get("asset", getattr(instance, "asset", None))
        task = data.get("task", getattr(instance, "task", None))
        shot, asset = VersionService.entity_of(shot=shot, asset=asset, task=task)
        entity = shot or asset
        if entity is not None:
            derived = {
                "entity_type": type(entity).__name__,
                "entity_id": str(entity.pk),
                "entity_code": entity.code,
                "entity_name": getattr(entity, "name", "") or "",
            }
            for key, expected in derived.items():
                given = str(data.get(key) or "").strip()
                if given and given.lower() != expected.lower():
                    raise ValidationError({key: ["Derived from the version's shot or asset."]})

    def perform_update(self, serializer):
        instance = serializer.instance
        if instance.is_published:
            from rest_framework.exceptions import ValidationError

            changed = sorted(
                key
                for key, value in serializer.validated_data.items()
                if key not in self.EDITABLE_WHEN_PUBLISHED and value != getattr(instance, key, None)
            )
            if changed:
                raise ValidationError(
                    {
                        "detail": [
                            "A published version cannot be changed except its notes and tags. "
                            "Unpublish it first."
                        ],
                        "fields": changed,
                    }
                )
        super().perform_update(serializer)

    @extend_schema(request=PublishVersionSerializer)
    @action(detail=True, methods=["post"], url_path="publish")
    def publish(self, request, *args, **kwargs):
        """Publish an approved version; records who and when."""
        instance = self.get_object()
        info = validated(PublishVersionSerializer, request.data)["publishing_info"]
        instance = VersionService.publish_version(actor=request.user, version=instance, info=info)
        return Response(VersionDetailSerializer(instance).data)

    @action(detail=True, methods=["post"], url_path="unpublish")
    def unpublish(self, request, *args, **kwargs):
        instance = self.get_object()
        instance = VersionService.unpublish_version(actor=request.user, version=instance)
        return Response(VersionDetailSerializer(instance).data)

    @extend_schema(request=PromoteVersionSerializer)
    @action(detail=True, methods=["post"], url_path="promote")
    def promote(self, request, *args, **kwargs):
        instance = self.get_object()
        body = validated(PromoteVersionSerializer, request.data)
        VersionService.promote_version(
            actor=request.user,
            version=instance,
            **self.status_kwargs(body.get("override_reason")),
        )
        return Response(VersionDetailSerializer(instance).data)

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
                PlaylistService.add_entry(
                    user=request.user, playlist=playlist, version_ref=instance.id
                )
        return Response(VersionDetailSerializer(instance).data)
