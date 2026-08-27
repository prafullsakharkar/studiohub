from rest_framework import serializers

from apps.core.api.serializers.base import BaseWriteSerializer
from apps.production.models import Asset


class AssetCreateSerializer(BaseWriteSerializer):
    id = serializers.UUIDField(read_only=True)
    uuid = serializers.UUIDField(read_only=True)

    class Meta:
        model = Asset
        fields = (
            "id",
            "uuid",
            "project",
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
        read_only_fields = ("id", "uuid")
