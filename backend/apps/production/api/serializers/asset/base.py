from rest_framework import serializers

from apps.core.api.serializers.base import BaseReadSerializer
from apps.production.models import Asset


class AssetSerializer(BaseReadSerializer):
    project_id = serializers.UUIDField(read_only=True)
    project_code = serializers.SerializerMethodField()
    project_name = serializers.SerializerMethodField()
    department_id = serializers.UUIDField(read_only=True, allow_null=True)
    department_name = serializers.SerializerMethodField()
    team_id = serializers.UUIDField(read_only=True, allow_null=True)
    team_name = serializers.SerializerMethodField()
    assigned_artist_id = serializers.UUIDField(read_only=True, allow_null=True)
    assigned_artist_name = serializers.SerializerMethodField()
    assigned_artist_avatar = serializers.SerializerMethodField()
    parent_asset_id = serializers.UUIDField(read_only=True, allow_null=True)

    class Meta:
        model = Asset
        fields = (
            "id",
            "uuid",
            "project_id",
            "project_code",
            "project_name",
            "name",
            "code",
            "category",
            "description",
            "status",
            "version",
            "thumbnail_url",
            "turntable_video_url",
            "file_format",
            "poly_count",
            "lod_levels",
            "software",
            "department_id",
            "department_name",
            "team_id",
            "team_name",
            "assigned_artist_id",
            "assigned_artist_name",
            "assigned_artist_avatar",
            "parent_asset_id",
            "tags",
            "usd_prim_path",
            "is_archived",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "uuid", "created_at", "updated_at")

    def get_project_code(self, obj):
        return obj.project.code if obj.project else ""

    def get_project_name(self, obj):
        return obj.project.name if obj.project else ""

    def get_department_name(self, obj):
        return obj.department.name if obj.department else ""

    def get_team_name(self, obj):
        return obj.team.name if obj.team else ""

    def get_assigned_artist_name(self, obj):
        if obj.assigned_artist:
            profile = getattr(obj.assigned_artist, "profile", None)
            if profile and getattr(profile, "display_name", None):
                return profile.display_name
            return obj.assigned_artist.email
        return ""

    def get_assigned_artist_avatar(self, obj):
        if obj.assigned_artist:
            profile = getattr(obj.assigned_artist, "profile", None)
            if profile and getattr(profile, "avatar", None):
                try:
                    return profile.avatar.url
                except Exception:
                    return None
        return None
