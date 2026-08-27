from rest_framework import serializers

from apps.core.api.serializers.base import BaseReadSerializer
from apps.production.models import Timelog


class TimelogSerializer(BaseReadSerializer):
    task_id = serializers.UUIDField(read_only=True)
    task_code = serializers.CharField(read_only=True)
    task_title = serializers.CharField(read_only=True)
    project_id = serializers.UUIDField(read_only=True, allow_null=True)
    project_code = serializers.CharField(read_only=True)
    project_name = serializers.SerializerMethodField()
    person_id = serializers.UUIDField(read_only=True)
    person_name = serializers.SerializerMethodField()
    person_avatar = serializers.SerializerMethodField()
    person_role = serializers.SerializerMethodField()
    department = serializers.CharField(read_only=True)

    class Meta:
        model = Timelog
        fields = (
            "id",
            "uuid",
            "task_id",
            "task_code",
            "task_title",
            "project_id",
            "project_code",
            "project_name",
            "person_id",
            "person_name",
            "person_avatar",
            "person_role",
            "department",
            "duration_hours",
            "date",
            "billable",
            "notes",
            "status",
            "approved_by_id",
            "approved_at",
            "rejection_reason",
            "activity_category",
            "hourly_rate_usd",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "uuid", "created_at", "updated_at")

    def get_project_name(self, obj):
        return obj.project.name if obj.project else ""

    def get_person_name(self, obj):
        if obj.person:
            profile = getattr(obj.person, "profile", None)
            if profile and getattr(profile, "display_name", None):
                return profile.display_name
            return obj.person.email
        return ""

    def get_person_avatar(self, obj):
        if obj.person:
            profile = getattr(obj.person, "profile", None)
            if profile and getattr(profile, "avatar", None):
                try:
                    return profile.avatar.url
                except Exception:
                    return None
        return None

    def get_person_role(self, obj):
        return ""
