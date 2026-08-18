from rest_framework import serializers

from apps.organization.api.serializers.base import OrganizationEntitySerializer
from apps.organization.choices import RolePriority, RoleScope, RoleType
from apps.organization.models import Role


class RoleBaseSerializer(OrganizationEntitySerializer):
    """
    Base serializer for Role.
    """

    class Meta(OrganizationEntitySerializer.Meta):
        model = Role

        fields = (
            *OrganizationEntitySerializer.Meta.fields,
            "code",
            "name",
            "description",
            "role_type",
            "scope",
            "priority",
            "parent",
            "icon",
            "color",
            "is_system",
            "is_default",
            "is_active",
            "sort_order",
        )

        read_only_fields = (
            *OrganizationEntitySerializer.Meta.read_only_fields,
            "code",
        )


class RoleCreateSerializer(RoleBaseSerializer):
    """
    Serializer for creating Role.
    """

    class Meta(RoleBaseSerializer.Meta):
        read_only_fields = (
            *RoleBaseSerializer.Meta.read_only_fields,
            "organization",
        )


class RoleUpdateSerializer(RoleBaseSerializer):
    """
    Serializer for updating Role.
    """

    class Meta(RoleBaseSerializer.Meta):
        read_only_fields = (
            *RoleBaseSerializer.Meta.read_only_fields,
            "code",
        )


class RoleListSerializer(RoleBaseSerializer):
    """
    Serializer for listing Role.
    """

    organization_name = serializers.CharField(source="organization.name", read_only=True)
    parent_name = serializers.CharField(source="parent.name", read_only=True)
    permission_count = serializers.IntegerField(read_only=True)
    user_count = serializers.IntegerField(read_only=True)
    group_count = serializers.IntegerField(read_only=True)

    class Meta(RoleBaseSerializer.Meta):
        fields = (
            *RoleBaseSerializer.Meta.fields,
            "organization_name",
            "parent_name",
            "permission_count",
            "user_count",
            "group_count",
        )


class RoleDetailSerializer(RoleBaseSerializer):
    """
    Serializer for retrieving Role details.
    """

    organization_name = serializers.CharField(source="organization.name", read_only=True)
    parent_name = serializers.CharField(source="parent.name", read_only=True)
    permissions = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    users = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    groups = serializers.PrimaryKeyRelatedField(many=True, read_only=True)

    class Meta(RoleBaseSerializer.Meta):
        fields = (
            *RoleBaseSerializer.Meta.fields,
            "organization_name",
            "parent_name",
            "permissions",
            "users",
            "groups",
        )


class RoleAssignSerializer(serializers.Serializer):
    """
    Serializer for assigning Role to users.
    """

    user = serializers.PrimaryKeyRelatedField(queryset=None, read_only=True)
    expires_at = serializers.DateTimeField(required=False, allow_null=True)


class RolePermissionSerializer(serializers.Serializer):
    """
    Serializer for Role permission operations.
    """

    permission = serializers.PrimaryKeyRelatedField(queryset=None, read_only=True)
    granted = serializers.BooleanField(default=True)
    expires_at = serializers.DateTimeField(required=False, allow_null=True)
