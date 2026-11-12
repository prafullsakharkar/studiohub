from typing import Any

from rest_framework import serializers

from apps.core.api.serializers.base import BaseReadSerializer
from apps.production.constants.permissions import ProjectPermissions
from apps.production.models import Project
from apps.production.permissions.checks import has_permission_code
from apps.production.selectors.base import ProductionBaseSelector

from .vendors import ProjectPageSerializer, VendorNamesField

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


BUDGET_FIELD = "budget_usd"


def can_view_budget(serializer: Any) -> bool:
    """
    Whether the serializer's caller may read the project's budget (``project.view_budget``,
    docs/sync CR-55). Asked once per response: the answer is kept in the shared context, so a
    page of projects checks it once. Without a request (internal use) the field stays.
    """
    context = serializer.context
    if "_can_view_budget" not in context:
        request = context.get("request")
        context["_can_view_budget"] = request is None or has_permission_code(
            request, ProjectPermissions.VIEW_BUDGET
        )
    return bool(context["_can_view_budget"])


# Leaves ``budget_usd`` out of the response for a caller without ``project.view_budget``. A comment,
# not a docstring: the OpenAPI schema takes a serializer's description from the first docstring in
# its MRO, and this mixin comes first.
class BudgetGatedMixin:
    def to_representation(self, instance):
        data = super().to_representation(instance)  # pyright: ignore[reportAttributeAccessIssue]
        if not can_view_budget(self):
            data.pop(BUDGET_FIELD, None)
        return data


class ProjectSerializer(BudgetGatedMixin, BaseReadSerializer[Any]):
    supervisor_id = serializers.UUIDField(read_only=True, allow_null=True)
    supervisor_name = serializers.SerializerMethodField()
    coordinator_id = serializers.UUIDField(read_only=True, allow_null=True)
    coordinator_name = serializers.SerializerMethodField()
    project_code = serializers.CharField(source="code", read_only=True)
    client_name = serializers.CharField(read_only=True)
    vendor_names = VendorNamesField()

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
            "approve_task_on_version_approval",
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
        list_serializer_class = ProjectPageSerializer

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
