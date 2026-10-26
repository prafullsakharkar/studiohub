from typing import Any

from rest_framework import serializers

from apps.core.api.serializers.base import BaseWriteSerializer
from apps.production.api.serializers.common import LockedFieldsMixin, NormalizedCodeMixin
from apps.production.models import Asset


class AssetUpdateSerializer(NormalizedCodeMixin, LockedFieldsMixin, BaseWriteSerializer[Any]):
    code_frozen_by = "asset"
    locked_fields = {
        "is_archived": "Use the archive and restore actions.",
    }

    is_archived = serializers.BooleanField(source="is_deleted", read_only=True)

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
            "tags",
            "usd_prim_path",
            "is_archived",
        )
