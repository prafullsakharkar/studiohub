from rest_framework import serializers

from apps.organization.api.serializers.base import OrganizationEntitySerializer
from apps.organization.models import UserRole


class UserRoleBaseSerializer(OrganizationEntitySerializer):
    """
    Base serializer for UserRole.
    """

    class Meta(OrganizationEntitySerializer.Meta):
        model = UserRole

        fields = (
            "id",
            "uuid",
            "user",
            "role",
            "created_at",
            "updated_at",
        )

        read_only_fields = (
            *OrganizationEntitySerializer.Meta.read_only_fields,
            "user",
            "role",
        )


class UserRoleAssignSerializer(serializers.Serializer):
    """
    Serializer for assigning UserRole.
    """

    user = serializers.PrimaryKeyRelatedField(queryset=None, read_only=True)
    role = serializers.PrimaryKeyRelatedField(queryset=None, read_only=True)
    expires_at = serializers.DateTimeField(required=False, allow_null=True)


class UserRoleRevokeSerializer(serializers.Serializer):
    """
    Serializer for revoking UserRole.
    """

    user = serializers.PrimaryKeyRelatedField(queryset=None, read_only=True)
    role = serializers.PrimaryKeyRelatedField(queryset=None, read_only=True)


class UserRoleListSerializer(UserRoleBaseSerializer):
    """
    Serializer for listing UserRole.
    """

    user_name = serializers.CharField(source="user.get_full_name", read_only=True)
    user_email = serializers.EmailField(source="user.email", read_only=True)
    role_name = serializers.CharField(source="role.name", read_only=True)
    role_code = serializers.CharField(source="role.code", read_only=True)

    class Meta(UserRoleBaseSerializer.Meta):
        fields = (
            *UserRoleBaseSerializer.Meta.fields,
            "user_name",
            "user_email",
            "role_name",
            "role_code",
        )


class UserRoleDetailSerializer(UserRoleBaseSerializer):
    """
    Serializer for retrieving UserRole details.
    """

    user_name = serializers.CharField(source="user.get_full_name", read_only=True)
    user_email = serializers.EmailField(source="user.email", read_only=True)
    role = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta(UserRoleBaseSerializer.Meta):
        fields = (
            *UserRoleBaseSerializer.Meta.fields,
            "user_name",
            "user_email",
            "role",
        )
