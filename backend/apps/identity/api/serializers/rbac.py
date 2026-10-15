"""
RBAC serializers (org-removal B3).

Flat platform-global shapes for the identity-owned authorization
resources: roles, groups, permissions.
"""

from __future__ import annotations

from apps.identity.api.serializers.base import IdentitySerializer
from apps.identity.models import Group, Permission, Role


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
            "created_at",
            "updated_at",
        )
