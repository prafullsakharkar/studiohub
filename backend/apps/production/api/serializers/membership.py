from typing import Any

from rest_framework import serializers

from apps.core.api.serializers.base import BaseReadSerializer, BaseWriteSerializer
from apps.core.api.serializers.fields import CaseInsensitiveChoiceField
from apps.production.models import ProjectMembership, Show


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
    projectId = serializers.SerializerMethodField()
    role_id = serializers.UUIDField(source="role_ref_id", read_only=True, allow_null=True)
    project_id = serializers.UUIDField(read_only=True)
    user_id = serializers.UUIDField(read_only=True)
    project_code = serializers.SerializerMethodField()
    project_name = serializers.SerializerMethodField()
    name = serializers.SerializerMethodField()
    email = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()
    # The show this membership is bound to (null: the whole project). CR-36.
    show_id = serializers.UUIDField(read_only=True, allow_null=True)
    show_code = serializers.SerializerMethodField()

    class Meta:
        model = ProjectMembership
        fields = (
            "id",
            "user_id",
            "userId",
            "project_id",
            "projectId",
            "project_code",
            "project_name",
            "name",
            "email",
            "avatar_url",
            "role",
            "role_id",
            "roles",
            "scope",
            "status",
            "show_id",
            "show_code",
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

    def get_show_code(self, obj):
        return obj.show.code if obj.show_id else ""


class _MemberRefsMixin:
    """What the add and the edit serializers both resolve: a show of the project, and a global role."""

    def _resolve_show(self, show_id):
        """The show, when it is a live show of this project; anything else is unknown (fail closed)."""
        project = self.context.get("project")
        show = Show.objects.filter(pk=show_id, project=project).first() if project is not None else None
        if show is None:
            raise serializers.ValidationError({"show": ["Unknown show."]})
        return show

    def _resolve_role_ref(self, role_ref):
        """Resolve a role id against the global identity roles.

        Unknown ids are rejected — fail closed.
        """
        from apps.identity.models import Role

        role = Role.objects.filter(id=role_ref, is_deleted=False).first()
        if role is None:
            raise serializers.ValidationError(
                {"role_id": "Unknown role."}
            )
        return role


class ProjectMembershipCreateSerializer(_MemberRefsMixin, BaseWriteSerializer[Any]):
    """Accept frontend member payload: {userId|user_id|email, role, roles?, scope?}."""

    userId = serializers.CharField(required=False, allow_blank=True, default="")
    user_id = serializers.CharField(required=False, allow_blank=True, default="")
    email = serializers.EmailField(required=False, allow_blank=True, default="")
    role = serializers.CharField(required=False, allow_blank=True, default="Artist")
    roles = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )
    scope = serializers.CharField(required=False, allow_blank=True, default="PROJECT")
    # Making the member external: with either set they see only what that vendor/client was
    # given (``selectors/external_scope.py``), not the whole project.
    vendor_id = serializers.CharField(required=False, allow_blank=True, default="", max_length=50)
    client_id = serializers.CharField(required=False, allow_blank=True, default="", max_length=50)
    # Canonical RBAC role (N7); resolved platform-wide in validate, fail closed.
    role_id = serializers.UUIDField(required=False, allow_null=True, write_only=True)
    # CR-36: bind the member to one show of this project. Omitted leaves the binding as it is; null clears it
    # (the whole project); an id binds it. A show of another project, or a deleted one, is refused.
    show = serializers.UUIDField(required=False, allow_null=True)
    # Frontend contract sends Title Case ("Active"); DB stores lowercase.
    status = CaseInsensitiveChoiceField(
        choices=ProjectMembership.STATUS_CHOICES, required=False, default="active"
    )

    class Meta:
        model = ProjectMembership
        fields = (
            "userId",
            "user_id",
            "email",
            "role",
            "roles",
            "scope",
            "status",
            "role_id",
            "vendor_id",
            "client_id",
            "show",
        )

    def validate(self, attrs):
        role_ref = attrs.pop("role_id", None)
        if role_ref is not None:
            attrs["role_ref"] = self._resolve_role_ref(role_ref)
        if attrs.get("show") is not None:
            attrs["show"] = self._resolve_show(attrs["show"])
        return attrs


class ProjectMembershipUpdateSerializer(_MemberRefsMixin, BaseWriteSerializer[Any]):
    """
    CR-37: change a member that is already on the project. Every field is optional and only what is sent changes;
    an empty body is refused. ``show`` is as on the add (null releases, an id binds); ``department`` and
    ``department_id`` are the text a task's department is matched against (blank clears).
    """

    role = serializers.CharField(required=False, max_length=100)
    roles = serializers.ListField(child=serializers.CharField(), required=False)
    role_id = serializers.UUIDField(required=False, write_only=True)
    status = CaseInsensitiveChoiceField(choices=ProjectMembership.STATUS_CHOICES, required=False)
    show = serializers.UUIDField(required=False, allow_null=True)
    department = serializers.CharField(required=False, allow_blank=True, max_length=100)
    department_id = serializers.CharField(required=False, allow_blank=True, max_length=50)

    class Meta:
        model = ProjectMembership
        fields = ("role", "roles", "role_id", "status", "show", "department", "department_id")

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError({"non_field_errors": ["Nothing to update."]})
        if "role_id" in attrs:
            attrs["role_ref"] = self._resolve_role_ref(attrs.pop("role_id"))
        if attrs.get("show") is not None:
            attrs["show"] = self._resolve_show(attrs["show"])
        # The display role and the role list must agree, or a role change would not show: a role alone is the list.
        if "role" in attrs and "roles" not in attrs:
            attrs["roles"] = [attrs["role"]]
        return attrs
