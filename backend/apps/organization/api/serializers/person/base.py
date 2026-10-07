"""
Person serializer base.
"""

from __future__ import annotations

from typing import Any

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.core.api.serializers.base import BaseReadSerializer
from apps.organization.models import Person


class PersonSerializer(BaseReadSerializer[Any]):
    # Frontend compat fields not on model — provide defaults
    full_name = serializers.CharField(source="name", read_only=True)
    avatar_url = serializers.SerializerMethodField()
    organization_id = serializers.SerializerMethodField()
    department_id = serializers.SerializerMethodField()
    department_name = serializers.SerializerMethodField()
    team_id = serializers.SerializerMethodField()
    team_name = serializers.SerializerMethodField()
    office_id = serializers.SerializerMethodField()
    office_name = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()
    role_id = serializers.UUIDField(read_only=True, allow_null=True)
    user_id = serializers.UUIDField(read_only=True, allow_null=True)
    skills = serializers.SerializerMethodField()
    seniority = serializers.SerializerMethodField()
    availability_status = serializers.SerializerMethodField()
    security_clearance = serializers.SerializerMethodField()
    timezone = serializers.SerializerMethodField()

    class Meta:
        model = Person
        fields = (
            "id",
            "uuid",
            "name",
            "full_name",
            "email",
            "phone",
            "date_of_birth",
            "nationality",
            "description",
            "created_at",
            "updated_at",
            # frontend compat
            "avatar_url",
            "organization_id",
            "department_id",
            "department_name",
            "team_id",
            "team_name",
            "office_id",
            "office_name",
            "role",
            "role_id",
            "user_id",
            "skills",
            "seniority",
            "availability_status",
            "security_clearance",
            "timezone",
        )
        read_only_fields = ("id", "uuid", "created_at", "updated_at")

    @extend_schema_field(serializers.URLField(allow_null=True))
    def get_avatar_url(self, obj):
        return None

    @extend_schema_field(serializers.UUIDField(allow_null=True))
    def get_organization_id(self, obj):
        return obj.organization_id

    @extend_schema_field(serializers.UUIDField(allow_null=True))
    def get_department_id(self, obj):
        return obj.department_id

    @extend_schema_field(serializers.CharField())
    def get_department_name(self, obj):
        dept = getattr(obj, "department", None)
        return dept.name if dept else ""

    @extend_schema_field(serializers.UUIDField(allow_null=True))
    def get_team_id(self, obj):
        return obj.team_id

    @extend_schema_field(serializers.CharField())
    def get_team_name(self, obj):
        team = getattr(obj, "team", None)
        return team.name if team else ""

    @extend_schema_field(serializers.UUIDField(allow_null=True))
    def get_office_id(self, obj):
        return obj.office_id

    @extend_schema_field(serializers.CharField())
    def get_office_name(self, obj):
        office = getattr(obj, "office", None)
        return office.name if office else ""

    @extend_schema_field(serializers.CharField(allow_blank=True))
    def get_role(self, obj):
        # Server-derived from the linked Position (Task A-3); no mock value.
        return obj.role.name if obj.role_id else ""

    @extend_schema_field(serializers.ListField(child=serializers.CharField()))
    def get_skills(self, obj):
        return obj.skills or []

    @extend_schema_field(serializers.CharField())
    def get_seniority(self, obj):
        return obj.seniority or ""

    @extend_schema_field(serializers.CharField())
    def get_availability_status(self, obj):
        return obj.availability_status or ""

    @extend_schema_field(serializers.CharField())
    def get_security_clearance(self, obj):
        return obj.security_clearance or ""

    @extend_schema_field(serializers.CharField())
    def get_timezone(self, obj):
        return obj.timezone or ""
