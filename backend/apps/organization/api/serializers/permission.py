from rest_framework import serializers

from apps.organization.api.serializers.base import OrganizationEntitySerializer
from apps.organization.models import Permission


class PermissionBaseSerializer(OrganizationEntitySerializer):
    """
    Base serializer for Permission.
    """

    class Meta(OrganizationEntitySerializer.Meta):
        model = Permission

        fields = (
            "id",
            "uuid",
            "code",
            "name",
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
            *OrganizationEntitySerializer.Meta.read_only_fields,
            "code",
        )


class PermissionCreateSerializer(PermissionBaseSerializer):
    """
    Serializer for creating Permission.
    """

    class Meta(PermissionBaseSerializer.Meta):
        read_only_fields = (
            *PermissionBaseSerializer.Meta.read_only_fields,
            "organization",
        )


class PermissionUpdateSerializer(PermissionBaseSerializer):
    """
    Serializer for updating Permission.
    """

    class Meta(PermissionBaseSerializer.Meta):
        read_only_fields = (
            *PermissionBaseSerializer.Meta.read_only_fields,
            "code",
        )


class PermissionListSerializer(PermissionBaseSerializer):
    """
    Serializer for listing Permission.
    """

    organization_name = serializers.CharField(source="organization.name", read_only=True)
    role_count = serializers.IntegerField(read_only=True)

    class Meta(PermissionBaseSerializer.Meta):
        fields = (
            *PermissionBaseSerializer.Meta.fields,
            "organization_name",
            "role_count",
        )


class PermissionDetailSerializer(PermissionBaseSerializer):
    """
    Serializer for retrieving Permission details.
    """

    organization_name = serializers.CharField(source="organization.name", read_only=True)
    roles = serializers.PrimaryKeyRelatedField(many=True, read_only=True)

    class Meta(PermissionBaseSerializer.Meta):
        fields = (
            *PermissionBaseSerializer.Meta.fields,
            "organization_name",
            "roles",
        )


class PermissionGrantSerializer(serializers.Serializer):
    """
    Serializer for granting Permission to Role.
    """

    role = serializers.PrimaryKeyRelatedField(queryset=None, read_only=True)
    granted = serializers.BooleanField(default=True)
    expires_at = serializers.DateTimeField(required=False, allow_null=True)
