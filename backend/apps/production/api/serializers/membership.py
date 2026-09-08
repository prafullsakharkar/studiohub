from typing import Any

from rest_framework import serializers

from apps.core.api.serializers.base import BaseReadSerializer, BaseWriteSerializer
from apps.production.models import ProjectMembership


def _user_display_name(user) -> str:
    if user is None:
        return ""
    profile = getattr(user, "profile", None)
    if profile and getattr(profile, "display_name", None):
        return profile.display_name
    return getattr(user, "email", "") or ""


def _user_avatar(user):
    if user is None:
        return None
    profile = getattr(user, "profile", None)
    if profile and getattr(profile, "avatar", None):
        try:
            return profile.avatar.url
        except Exception:
            return None
    return None


class ProjectMembershipSerializer(BaseReadSerializer[Any]):
    """Frontend ProjectMembership shape (dual snake/camel keys + denormalized user)."""

    userId = serializers.SerializerMethodField()
    organizationId = serializers.SerializerMethodField()
    projectId = serializers.SerializerMethodField()
    organization_id = serializers.UUIDField(read_only=True)
    project_id = serializers.UUIDField(read_only=True)
    user_id = serializers.UUIDField(read_only=True)
    project_code = serializers.SerializerMethodField()
    project_name = serializers.SerializerMethodField()
    name = serializers.SerializerMethodField()
    email = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = ProjectMembership
        fields = (
            "id",
            "user_id",
            "userId",
            "organization_id",
            "organizationId",
            "project_id",
            "projectId",
            "project_code",
            "project_name",
            "name",
            "email",
            "avatar_url",
            "role",
            "roles",
            "scope",
            "status",
            "department",
            "department_id",
            "team_id",
            "vendor_id",
            "client_id",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "created_at",
            "updated_at",
        )

    def get_userId(self, obj):
        return str(obj.user_id)

    def get_organizationId(self, obj):
        return str(obj.organization_id)

    def get_projectId(self, obj):
        return str(obj.project_id)

    def get_project_code(self, obj):
        return obj.project.code if obj.project else ""

    def get_project_name(self, obj):
        return obj.project.name if obj.project else ""

    def get_name(self, obj):
        return _user_display_name(obj.user)

    def get_email(self, obj):
        return getattr(obj.user, "email", "") or ""

    def get_avatar_url(self, obj):
        return _user_avatar(obj.user)


class ProjectMembershipCreateSerializer(BaseWriteSerializer[Any]):
    """Accept frontend member payload: {userId|user_id|email, role, roles?, scope?}."""

    userId = serializers.CharField(required=False, allow_blank=True, default="")
    user_id = serializers.CharField(required=False, allow_blank=True, default="")
    email = serializers.EmailField(required=False, allow_blank=True, default="")
    role = serializers.CharField(required=False, allow_blank=True, default="Artist")
    roles = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )
    scope = serializers.CharField(required=False, allow_blank=True, default="PROJECT")

    class Meta:
        model = ProjectMembership
        fields = ("userId", "user_id", "email", "role", "roles", "scope")
