from typing import Any

from rest_framework import serializers

from apps.organization.models.team import Team


class TeamBaseSerializer(serializers.ModelSerializer[Any]):

    organization_id = serializers.UUIDField(
        read_only=True,
        allow_null=True,
    )
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    department_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)
    department = serializers.PrimaryKeyRelatedField(read_only=True, required=False, allow_null=True)
    department_name = serializers.SerializerMethodField()
    lead_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)
    lead = serializers.PrimaryKeyRelatedField(read_only=True, allow_null=True)
    lead_name = serializers.SerializerMethodField()
    lead_name = serializers.SerializerMethodField()
    capacity_hours_weekly = serializers.IntegerField(source="capacity", read_only=True)

    def to_internal_value(self, data):
        # Frontend contract: submit `organization_id` / `department_id` /
        # `lead_id` as UUID strings; treat empty strings as "no pick" and
        # normalize onto the model's FK names.
        if isinstance(data, dict):
            data = dict(data)
            # Only normalize keys the caller actually sent: injecting
            # ``None`` for absent keys wipes relations (e.g. department)
            # on every partial update that omits them.
            for fk in ("department", "lead", "organization"):
                if fk not in data:
                    continue
                raw = data[fk]
                data[f"{fk}_id"] = None if raw in (None, "") else raw
        return super().to_internal_value(data)

    def get_department_name(self, obj):
        dept = getattr(obj, "department", None)
        return dept.name if dept else ""

    def get_lead_name(self, obj):
        lead = getattr(obj, "lead", None)
        return lead.name if lead else ""

    class Meta:
        model = Team
        fields = (
            "id",
            "uuid",
            "code",
            "name",
            "description",
            "organization",
            "organization_id",
            "department",
            "department_id",
            "department_name",
            "lead",
            "lead_id",
            "lead_name",
            "color",
            "capacity",
            "capacity_hours_weekly",
            "focus_discipline",
            "current_project_code",
            "utilization_percentage",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "uuid",
            "created_at",
            "updated_at",
            "organization",
            "organization_id",
            "department",
            "department_name",
            "lead",
            "lead_name",
        )
