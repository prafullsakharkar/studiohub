from rest_framework import serializers

from apps.core.api.serializers.base import BaseReadSerializer
from apps.production.models import Sequence, Shot


class SequenceSerializer(BaseReadSerializer):
    project_id = serializers.UUIDField(read_only=True)
    project_code = serializers.SerializerMethodField()
    project_name = serializers.SerializerMethodField()
    shots_count = serializers.SerializerMethodField()
    is_deleted = serializers.BooleanField(read_only=True)
    deleted_at = serializers.DateTimeField(read_only=True, allow_null=True)

    class Meta:
        model = Sequence
        fields = (
            "id",
            "uuid",
            "project_id",
            "project_code",
            "project_name",
            "code",
            "name",
            "status",
            "description",
            "frame_in",
            "frame_out",
            "department",
            "tags",
            "metadata",
            "shots_count",
            "is_deleted",
            "deleted_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "uuid",
            "is_deleted",
            "deleted_at",
            "created_at",
            "updated_at",
        )

    def get_project_code(self, obj):
        return obj.project.code if obj.project else ""

    def get_project_name(self, obj):
        return obj.project.name if obj.project else ""

    def get_shots_count(self, obj):
        return (
            Shot.objects.filter(
                organization=obj.organization,
                project=obj.project,
                sequence_code=obj.code,
            ).count()
        )
