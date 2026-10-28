from typing import Any

from rest_framework import serializers

from apps.core.api.serializers.base import BaseWriteSerializer
from apps.production.api.serializers.common import (
    LenientUniqueTogetherValidator,
    LockedFieldsMixin,
    NormalizedCodeMixin,
    ProjectReferenceMixin,
    ScopedReferenceField,
)
from apps.production.models import Asset


class AssetCreateSerializer(
    NormalizedCodeMixin, LockedFieldsMixin, ProjectReferenceMixin, BaseWriteSerializer[Any]
):
    locked_fields = {
        "is_archived": "Use the archive and restore actions.",
    }

    is_archived = serializers.BooleanField(source="is_deleted", read_only=True)
    # An id or code of an active asset type in the catalog (resolved by the viewset).
    asset_type_id = serializers.CharField(
        source="asset_type", write_only=True, required=False, allow_blank=True, allow_null=True
    )
    # Limited to the caller's projects; the viewset checks it belongs to the asset's own project.
    parent_asset = ScopedReferenceField(
        queryset=Asset.objects.all(), required=False, allow_null=True
    )
    id = serializers.UUIDField(read_only=True)
    uuid = serializers.UUIDField(read_only=True)

    # Files the record under a show (TPN review TM-002). The viewset resolves it inside the project.
    show_id = serializers.UUIDField(
        source="show", write_only=True, required=False, allow_null=True
    )

    class Meta:
        model = Asset
        fields = (
            "show_id",
            "id",
            "uuid",
            "project",
            "project_id",
            "project_code",
            "name",
            "code",
            "category",
            "description",
            "status",
            "version",
            "file_format",
            "poly_count",
            "lod_levels",
            "software",
            "thumbnail_url",
            "department",
            "team",
            "assigned_artist",
            "parent_asset",
            "asset_type_id",
            "tags",
            "usd_prim_path",
            "is_archived",
        )
        read_only_fields = ("id", "uuid")
        extra_kwargs = {"project": {"required": False}}
        validators = [
            LenientUniqueTogetherValidator(
                queryset=Asset.objects.all(),
                fields=["project", "code"],
            )
        ]
