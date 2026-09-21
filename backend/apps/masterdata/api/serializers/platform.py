"""
Platform taxonomy serializers.

Field names preserve the frontend contract, including the camelCase keys
used by the Platform Admin tabs (e.g. ``badgeColor``/``userCount``); snake_case
duplicates are emitted alongside so both spellings work.
"""

from __future__ import annotations

from rest_framework import serializers

from apps.masterdata.models import (
    PlatformDepartment,
    PlatformGroup,
    PlatformPosition,
    PlatformRole,
)


class PlatformRoleSerializer(serializers.ModelSerializer[PlatformRole]):
    badgeColor = serializers.CharField(source="badge_color", read_only=True)
    userCount = serializers.IntegerField(source="user_count", read_only=True)

    class Meta:
        model = PlatformRole
        fields = (
            "id",
            "name",
            "code",
            "description",
            "badge",
            "badge_color",
            "badgeColor",
            "scope",
            "permissions",
            "user_count",
            "userCount",
            "is_system",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class PlatformGroupSerializer(serializers.ModelSerializer[PlatformGroup]):
    memberCount = serializers.IntegerField(source="member_count", read_only=True)

    class Meta:
        model = PlatformGroup
        fields = (
            "id",
            "name",
            "code",
            "description",
            "member_count",
            "memberCount",
            "roles",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class PlatformDepartmentSerializer(serializers.ModelSerializer[PlatformDepartment]):
    taskTypesCount = serializers.IntegerField(source="task_types_count", read_only=True)

    class Meta:
        model = PlatformDepartment
        fields = (
            "id",
            "name",
            "code",
            "lead",
            "description",
            "color",
            "software_stack",
            "capacity_hours_weekly",
            "task_types_count",
            "taskTypesCount",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class PlatformPositionSerializer(serializers.ModelSerializer[PlatformPosition]):
    class Meta:
        model = PlatformPosition
        fields = (
            "id",
            "title",
            "code",
            "level",
            "department",
            "band_level",
            "salary_range",
            "employment_type",
            "status",
            "description",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")
