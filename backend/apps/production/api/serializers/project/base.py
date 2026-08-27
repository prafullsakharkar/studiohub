from rest_framework import serializers

from apps.core.api.serializers.base import BaseReadSerializer
from apps.production.models import Project


class ProjectSerializer(BaseReadSerializer):
    supervisor_id = serializers.UUIDField(read_only=True, allow_null=True)
    supervisor_name = serializers.SerializerMethodField()
    coordinator_id = serializers.UUIDField(read_only=True, allow_null=True)
    coordinator_name = serializers.SerializerMethodField()
    project_code = serializers.CharField(source="code", read_only=True)
    client_name = serializers.CharField(read_only=True)
    organization_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = Project
        fields = (
            "id",
            "uuid",
            "code",
            "project_code",
            "name",
            "description",
            "type",
            "status",
            "fps",
            "resolution",
            "aspect_ratio",
            "color_space",
            "start_date",
            "delivery_date",
            "thumbnail_url",
            "total_shots",
            "approved_shots",
            "in_progress_shots",
            "total_assets",
            "budget_usd",
            "supervisor_id",
            "supervisor_name",
            "coordinator_id",
            "coordinator_name",
            "client_id",
            "client_name",
            "client_contact_id",
            "client_contact_name",
            "vendor_ids",
            "vendor_names",
            "vendor_team_ids",
            "organization_id",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "uuid", "created_at", "updated_at", "organization_id")

    def get_supervisor_name(self, obj):
        if obj.supervisor:
            # Try profile full name
            profile = getattr(obj.supervisor, "profile", None)
            if profile and getattr(profile, "display_name", None):
                return profile.display_name
            return obj.supervisor.email
        return ""

    def get_coordinator_name(self, obj):
        if obj.coordinator:
            profile = getattr(obj.coordinator, "profile", None)
            if profile and getattr(profile, "display_name", None):
                return profile.display_name
            return obj.coordinator.email
        return ""
