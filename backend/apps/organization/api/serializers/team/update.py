
from django.db import models
from rest_framework import serializers

from apps.organization.models import Department, Person

from .base import TeamBaseSerializer


class TeamUpdateSerializer(TeamBaseSerializer):
    """
    Input serializer for updating Team.

    Accepts the flat frontend contract ids and plural aliases; maps them
    onto the ``department`` / ``lead`` relations and ``capacity``.
    """

    department_id = serializers.UUIDField(required=False, allow_null=True)
    lead_id = serializers.UUIDField(required=False, allow_null=True)
    capacity_hours_weekly = serializers.IntegerField(required=False)

    class Meta(TeamBaseSerializer.Meta):
        fields = (
            "id",
            "uuid",
            "code",
            "name",
            "description",
            "organization",
            "department",
            "lead",
            "color",
            "capacity",
            "focus_discipline",
            "current_project_code",
            "utilization_percentage",
            "department_id",
            "lead_id",
            "capacity_hours_weekly",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "uuid",
            "organization",
            "created_at",
            "updated_at",
        )

    def validate(self, attrs):
        attrs = super().validate(attrs)
        region = getattr(self.instance, "organization", None)

        if "department_id" in attrs:
            ref = attrs.pop("department_id")
            if ref is None:
                attrs["department"] = None
            else:
                qs = Department.objects.filter(id=ref, is_deleted=False)
                if region is not None:
                    qs = qs.filter(organization_id=region.id)
                target = qs.first()
                if target is None:
                    raise serializers.ValidationError({"department_id": "Unknown department."})
                attrs["department"] = target

        if "lead_id" in attrs:
            ref = attrs.pop("lead_id")
            if ref is None:
                attrs["lead"] = None
            else:
                qs = Person.objects.filter(id=ref, is_deleted=False)
                if region is not None:
                    # Person.organization is nullable for legacy rows.
                    qs = qs.filter(
                        models.Q(organization_id=region.id)
                        | models.Q(organization__isnull=True)
                    )
                target = qs.first()
                if target is None:
                    raise serializers.ValidationError({"lead_id": "Unknown person."})
                attrs["lead"] = target

        if "capacity_hours_weekly" in attrs:
            attrs["capacity"] = attrs.pop("capacity_hours_weekly") or 0

        return attrs

    def update(self, instance, validated_data):
        from apps.organization.services.team import TeamService

        return TeamService.update(
            instance=instance,
            **validated_data,
        )

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["department_id"] = str(instance.department_id) if instance.department_id else None
        data["lead_id"] = str(instance.lead_id) if instance.lead_id else None
        data["capacity_hours_weekly"] = instance.capacity
        lead = getattr(instance, "lead", None)
        data["lead_name"] = lead.name if lead else ""
        dept = getattr(instance, "department", None)
        data["department_name"] = dept.name if dept else ""
        return data
