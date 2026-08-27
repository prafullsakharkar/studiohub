from rest_framework import serializers

from apps.core.api.serializers.base import BaseReadSerializer
from apps.production.models import Task


class TaskSerializer(BaseReadSerializer):
    project_id = serializers.UUIDField(read_only=True)
    project_code = serializers.SerializerMethodField()
    project_name = serializers.SerializerMethodField()
    team_id = serializers.UUIDField(read_only=True, allow_null=True)
    team_name = serializers.SerializerMethodField()
    assignee_id = serializers.UUIDField(read_only=True, allow_null=True)
    assignee_name = serializers.SerializerMethodField()
    assignee_avatar = serializers.SerializerMethodField()
    assignee_role = serializers.SerializerMethodField()
    reviewer_id = serializers.UUIDField(read_only=True, allow_null=True)
    reviewer_name = serializers.SerializerMethodField()
    reviewer_avatar = serializers.SerializerMethodField()
    department = serializers.CharField(read_only=True)
    entity_type = serializers.CharField(read_only=True)
    entity_id = serializers.CharField(read_only=True)
    entity_code = serializers.CharField(read_only=True)
    entity_name = serializers.CharField(read_only=True)

    class Meta:
        model = Task
        fields = (
            "id",
            "uuid",
            "title",
            "code",
            "project_id",
            "project_code",
            "project_name",
            "entity_type",
            "entity_id",
            "entity_code",
            "entity_name",
            "department",
            "department_id",
            "team_id",
            "team_name",
            "assignee_id",
            "assignee_name",
            "assignee_avatar",
            "assignee_role",
            "reviewer_id",
            "reviewer_name",
            "reviewer_avatar",
            "vendor_id",
            "vendor_name",
            "vendor_code",
            "workflow",
            "status",
            "priority",
            "schedule",
            "dependencies",
            "description",
            "software",
            "tags",
            "is_archived",
            "due_date",
            "estimated_hours",
            "logged_hours",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "uuid", "created_at", "updated_at")

    def get_project_code(self, obj):
        return obj.project.code if obj.project else ""

    def get_project_name(self, obj):
        return obj.project.name if obj.project else ""

    def get_team_name(self, obj):
        return obj.team.name if obj.team else ""

    def get_assignee_name(self, obj):
        if obj.assignee:
            profile = getattr(obj.assignee, "profile", None)
            if profile and getattr(profile, "display_name", None):
                return profile.display_name
            return obj.assignee.email
        return ""

    def get_assignee_avatar(self, obj):
        if obj.assignee:
            profile = getattr(obj.assignee, "profile", None)
            if profile and getattr(profile, "avatar", None):
                try:
                    return profile.avatar.url
                except Exception:
                    return None
        return None

    def get_assignee_role(self, obj):
        # Could be derived from membership role, fallback to empty
        return ""

    def get_reviewer_name(self, obj):
        if obj.reviewer:
            profile = getattr(obj.reviewer, "profile", None)
            if profile and getattr(profile, "display_name", None):
                return profile.display_name
            return obj.reviewer.email
        return ""

    def get_reviewer_avatar(self, obj):
        if obj.reviewer:
            profile = getattr(obj.reviewer, "profile", None)
            if profile and getattr(profile, "avatar", None):
                try:
                    return profile.avatar.url
                except Exception:
                    return None
        return None
