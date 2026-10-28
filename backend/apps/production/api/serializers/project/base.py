from typing import Any

from rest_framework import serializers

from apps.core.api.serializers.base import BaseReadSerializer
from apps.production.models import Project
from apps.production.selectors.base import ProductionBaseSelector

# What an external (vendor/client) member must not read from the project record: money, progress
# totals, the client's people, the other vendors, and the studio's own supervisors.
EXTERNAL_HIDDEN_FIELDS = (
    "budget_usd",
    "total_shots",
    "approved_shots",
    "in_progress_shots",
    "total_assets",
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
)


class ProjectSerializer(BaseReadSerializer[Any]):
    supervisor_id = serializers.UUIDField(read_only=True, allow_null=True)
    supervisor_name = serializers.SerializerMethodField()
    coordinator_id = serializers.UUIDField(read_only=True, allow_null=True)
    coordinator_name = serializers.SerializerMethodField()
    project_code = serializers.CharField(source="code", read_only=True)
    client_name = serializers.CharField(read_only=True)

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
            "workflow_type",
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
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "uuid", "created_at", "updated_at")

    def to_representation(self, instance):
        data = super().to_representation(instance)

        request = self.context.get("request")
        if request is not None and ProductionBaseSelector.is_external_on(request, instance.pk):
            for field in EXTERNAL_HIDDEN_FIELDS:
                data.pop(field, None)

        return data

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
