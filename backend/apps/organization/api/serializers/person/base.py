"""
Person serializer base.
"""

from __future__ import annotations

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.core.api.serializers.base import BaseReadSerializer
from apps.organization.models import Person


class PersonSerializer(BaseReadSerializer):
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
        return None

    @extend_schema_field(serializers.UUIDField(allow_null=True))
    def get_department_id(self, obj):
        return None

    @extend_schema_field(serializers.CharField())
    def get_department_name(self, obj):
        return ""

    @extend_schema_field(serializers.UUIDField(allow_null=True))
    def get_team_id(self, obj):
        return None

    @extend_schema_field(serializers.CharField())
    def get_team_name(self, obj):
        return ""

    @extend_schema_field(serializers.UUIDField(allow_null=True))
    def get_office_id(self, obj):
        return None

    @extend_schema_field(serializers.CharField())
    def get_office_name(self, obj):
        return ""

    @extend_schema_field(serializers.CharField())
    def get_role(self, obj):
        return "Artist"

    @extend_schema_field(serializers.ListField(child=serializers.CharField()))
    def get_skills(self, obj):
        return []

    @extend_schema_field(serializers.CharField())
    def get_seniority(self, obj):
        return "Mid"

    @extend_schema_field(serializers.CharField())
    def get_availability_status(self, obj):
        return "Available"

    @extend_schema_field(serializers.CharField())
    def get_security_clearance(self, obj):
        return ""

    @extend_schema_field(serializers.CharField())
    def get_timezone(self, obj):
        return "UTC"
