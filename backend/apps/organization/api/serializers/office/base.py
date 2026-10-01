from typing import Any

from rest_framework import serializers

from apps.organization.api.serializers.base import (
    OrganizationEntitySerializer,
)
from apps.organization.models.office import Office


class OfficeBaseSerializer(
    OrganizationEntitySerializer[Any],
):
    # Flat id the frontend contract reads (edit form manager selector).
    manager_id = serializers.UUIDField(read_only=True, allow_null=True)
    manager_name = serializers.SerializerMethodField()

    def get_manager_name(self, obj):
        mgr = getattr(obj, "manager", None)
        return mgr.name if mgr else ""

    class Meta(OrganizationEntitySerializer.Meta):
        model = Office

        fields = (
            "id",
            "uuid",
            "organization",
            "code",
            "name",
            "description",
            "office_type",
            "timezone",
            "country",
            "state",
            "city",
            "address",
            "postal_code",
            "phone",
            "email",
            "manager",
            "manager_id",
            "manager_name",
            "is_headquarters",
            "working_hours",
            "headcount",
            "workstations_count",
            "render_nodes_count",
            "is_active",
            "created_at",
            "updated_at",
        )
