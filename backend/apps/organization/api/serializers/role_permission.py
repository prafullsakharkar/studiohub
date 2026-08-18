from rest_framework import serializers

from apps.organization.api.serializers.base import OrganizationEntitySerializer
from apps.organization.models import RolePermission


class RolePermissionBaseSerializer(OrganizationEntitySerializer):
    """
    Base serializer for RolePermission.
    """

    class Meta(OrganizationEntitySerializer.Meta):
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
            "created_at",
            "updated_at",
        )

        read_only_fields = (
            *OrganizationEntitySerializer.Meta.read_only_fields,
            "role",
            "permission",
            "granted_at",
            "granted_by",
        )


class RolePermissionCreateSerializer(RolePermissionBaseSerializer):
    """
    Serializer for creating RolePermission.
    """

    class Meta(RolePermissionBaseSerializer.Meta):
        read_only_fields = (
            *RolePermissionBaseSerializer.Meta.read_only_fields,
            "organization",
        )


class RolePermissionUpdateSerializer(RolePermissionBaseSerializer):
    """
    Serializer for updating RolePermission.
    """

    class Meta(RolePermissionBaseSerializer.Meta):
        read_only_fields = (
            *RolePermissionBaseSerializer.Meta.read_only_fields,
            "role",
            "permission",
            "granted_at",
            "granted_by",
        )


class RolePermissionListSerializer(RolePermissionBaseSerializer):
    """
    Serializer for listing RolePermission.
    """

    role_name = serializers.CharField(source="role.name", read_only=True)
    role_code = serializers.CharField(source="role.code", read_only=True)
    permission_name = serializers.CharField(source="permission.name", read_only=True)
    permission_code = serializers.CharField(source="permission.code", read_only=True)
    granted_by_name = serializers.CharField(
        source="granted_by.get_full_name", read_only=True
    )

    class Meta(RolePermissionBaseSerializer.Meta):
        fields = (
            *RolePermissionBaseSerializer.Meta.fields,
            "role_name",
            "role_code",
            "permission_name",
            "permission_code",
            "granted_by_name",
        )


class RolePermissionDetailSerializer(RolePermissionBaseSerializer):
    """
    Serializer for retrieving RolePermission details.
    """

    role = serializers.PrimaryKeyRelatedField(read_only=True)
    permission = serializers.PrimaryKeyRelatedField(read_only=True)
    granted_by = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta(RolePermissionBaseSerializer.Meta):
        fields = (
            *RolePermissionBaseSerializer.Meta.fields,
            "role",
            "permission",
            "granted_by",
        )


class RolePermissionGrantSerializer(serializers.Serializer):
    """
    Serializer for granting RolePermission.
    """

    permission = serializers.PrimaryKeyRelatedField(queryset=None, read_only=True)
    granted = serializers.BooleanField(default=True)
    expires_at = serializers.DateTimeField(required=False, allow_null=True)


class RolePermissionRevokeSerializer(serializers.Serializer):
    """
    Serializer for revoking RolePermission.
    """

    permission = serializers.PrimaryKeyRelatedField(queryset=None, read_only=True)
