from apps.core.api.serializers.base import BaseWriteSerializer
from apps.production.models import Asset


class AssetUpdateSerializer(BaseWriteSerializer):
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
