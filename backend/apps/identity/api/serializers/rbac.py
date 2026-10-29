"""
RBAC serializers (org-removal B3).

Flat platform-global shapes for the identity-owned authorization
resources: roles, groups, permissions.
"""

from __future__ import annotations

from rest_framework import serializers

from apps.identity.api.serializers.base import IdentitySerializer
from apps.identity.models import (
    Group,
    GroupMember,
    GroupRole,
    Permission,
    Role,
    RolePermission,
    User,
    UserRole,
)


class RoleSerializer(IdentitySerializer):
    class Meta(IdentitySerializer.Meta):
        model = Role

        fields = (
            "id",
            "uuid",
            "name",
            "code",
            "description",
            "parent",
            "role_type",
            "scope",
            "priority",
            "icon",
            "color",
            "is_system",
            "is_default",
            "is_active",
            "sort_order",
            "created_at",
            "updated_at",
        )

        read_only_fields = (
            "id",
            "uuid",
            # DOM-RBAC-03: system rows are seeded; the API cannot mark a
            # record as system. ``code`` stays writable so creation works —
            # the service enforces immutability on update.
            "is_system",
            "created_at",
            "updated_at",
        )


class GroupSerializer(IdentitySerializer):
    class Meta(IdentitySerializer.Meta):
        model = Group

        fields = (
            "id",
            "uuid",
            "code",
            "name",
            "description",
            "color",
            "is_system",
            "created_at",
            "updated_at",
        )

        read_only_fields = (
            "id",
            "uuid",
            "is_system",
            "created_at",
            "updated_at",
        )


class PermissionSerializer(IdentitySerializer):
    class Meta(IdentitySerializer.Meta):
        model = Permission

        fields = (
            "id",
            "uuid",
            "name",
            "code",
            "module",
            "action",
            "category",
            "description",
            "is_system",
            "is_active",
            "sort_order",
            "created_at",
            "updated_at",
        )

        read_only_fields = (
            "id",
            "uuid",
            "is_system",
            "created_at",
            "updated_at",
        )


class UserBriefSerializer(serializers.ModelSerializer):  # pyright: ignore[reportMissingTypeArgument]
    class Meta:
        model = User
        fields = ("id", "email", "is_active")


class RoleBriefSerializer(serializers.ModelSerializer):  # pyright: ignore[reportMissingTypeArgument]
    class Meta:
        model = Role
        fields = ("id", "name", "code")


class GroupBriefSerializer(serializers.ModelSerializer):  # pyright: ignore[reportMissingTypeArgument]
    class Meta:
        model = Group
        fields = ("id", "name", "code")


class PermissionBriefSerializer(serializers.ModelSerializer):  # pyright: ignore[reportMissingTypeArgument]
    class Meta:
        model = Permission
        fields = ("id", "name", "code", "module", "action")


class RolePermissionListSerializer(IdentitySerializer):
    role = RoleBriefSerializer(read_only=True)
    permission = PermissionBriefSerializer(read_only=True)
    granted_by = UserBriefSerializer(read_only=True)

    class Meta(IdentitySerializer.Meta):
        model = RolePermission

        fields = (
            "id",
            "uuid",
            "role",
            "permission",
            "granted",
            "granted_at",
            "granted_by",
            "expires_at",
        )

        read_only_fields = (
            "id",
            "uuid",
            "granted_at",
        )


class RoleUserListSerializer(IdentitySerializer):
    user = UserBriefSerializer(read_only=True)
    role = RoleBriefSerializer(read_only=True)

    class Meta(IdentitySerializer.Meta):
        model = UserRole

        fields = (
            "id",
            "uuid",
            "user",
            "role",
            "created_at",
            "updated_at",
        )


class RoleGroupListSerializer(IdentitySerializer):
    group = GroupBriefSerializer(read_only=True)
    role = RoleBriefSerializer(read_only=True)

    class Meta(IdentitySerializer.Meta):
        model = GroupRole

        fields = (
            "id",
            "uuid",
            "group",
            "role",
            "created_at",
            "updated_at",
        )


class GroupMemberListSerializer(IdentitySerializer):
    user = UserBriefSerializer(read_only=True)
    group = GroupBriefSerializer(read_only=True)

    class Meta(IdentitySerializer.Meta):
        model = GroupMember

        fields = (
            "id",
            "uuid",
            "user",
            "group",
            "is_owner",
            "is_manager",
            "joined_at",
            "left_at",
            "created_at",
            "updated_at",
        )


class GroupRoleListSerializer(IdentitySerializer):
    group = GroupBriefSerializer(read_only=True)
    role = RoleBriefSerializer(read_only=True)

    class Meta(IdentitySerializer.Meta):
        model = GroupRole

        fields = (
            "id",
            "uuid",
            "group",
            "role",
            "created_at",
            "updated_at",
        )


class GrantPermissionSerializer(serializers.Serializer):  # pyright: ignore[reportMissingTypeArgument]
    permission_id = serializers.PrimaryKeyRelatedField(
        queryset=Permission.objects.all(),
        source="permission",
    )

    expires_at = serializers.DateTimeField(
        required=False,
        allow_null=True,
    )


class RevokePermissionSerializer(serializers.Serializer):  # pyright: ignore[reportMissingTypeArgument]
    permission_id = serializers.PrimaryKeyRelatedField(
        queryset=Permission.objects.all(),
        source="permission",
    )


class AssignUserSerializer(serializers.Serializer):  # pyright: ignore[reportMissingTypeArgument]
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source="user",
    )


class AddMemberSerializer(serializers.Serializer):  # pyright: ignore[reportMissingTypeArgument]
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source="user",
    )

    is_owner = serializers.BooleanField(
        required=False,
        default=False,
    )

    is_manager = serializers.BooleanField(
        required=False,
        default=False,
    )


class AttachRoleSerializer(serializers.Serializer):  # pyright: ignore[reportMissingTypeArgument]
    role_id = serializers.PrimaryKeyRelatedField(
        queryset=Role.objects.all(),
        source="role",
    )


class AttachGroupSerializer(serializers.Serializer):  # pyright: ignore[reportMissingTypeArgument]
    group_id = serializers.PrimaryKeyRelatedField(
        queryset=Group.objects.all(),
        source="group",
    )
