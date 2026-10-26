from typing import Any

from rest_framework import serializers

from apps.core.api.serializers.base import BaseWriteSerializer
from apps.production.api.serializers.common import (
    LockedFieldsMixin,
    NormalizedCodeMixin,
    ScopedReferenceField,
)
from apps.production.models import Asset


class AssetUpdateSerializer(NormalizedCodeMixin, LockedFieldsMixin, BaseWriteSerializer[Any]):
    code_frozen_by = "asset"
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

    class Meta:
        model = Asset
        fields = (
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
