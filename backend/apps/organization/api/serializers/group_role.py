from rest_framework import serializers

from apps.organization.api.serializers.base import OrganizationEntitySerializer
from apps.organization.models import GroupRole


class GroupRoleBaseSerializer(OrganizationEntitySerializer):
    """
    Base serializer for GroupRole.
    """

    class Meta(OrganizationEntitySerializer.Meta):
        model = GroupRole

        fields = (
            "id",
            "uuid",
            "group",
            "role",
            "created_at",
            "updated_at",
        )

        read_only_fields = (
            *OrganizationEntitySerializer.Meta.read_only_fields,
            "group",
            "role",
        )


class GroupRoleCreateSerializer(GroupRoleBaseSerializer):
    """
    Serializer for creating GroupRole.
    """

    class Meta(GroupRoleBaseSerializer.Meta):
        read_only_fields = (
            *GroupRoleBaseSerializer.Meta.read_only_fields,
            "organization",
        )


class GroupRoleListSerializer(GroupRoleBaseSerializer):
    """
    Serializer for listing GroupRole.
    """

    group_name = serializers.CharField(source="group.name", read_only=True)
    role_name = serializers.CharField(source="role.name", read_only=True)
    role_code = serializers.CharField(source="role.code", read_only=True)

    class Meta(GroupRoleBaseSerializer.Meta):
        fields = (
            *GroupRoleBaseSerializer.Meta.fields,
            "group_name",
            "role_name",
            "role_code",
        )


class GroupRoleDetailSerializer(GroupRoleBaseSerializer):
    """
    Serializer for retrieving GroupRole details.
    """

    group = serializers.PrimaryKeyRelatedField(read_only=True)
    role = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta(GroupRoleBaseSerializer.Meta):
        fields = (
            *GroupRoleBaseSerializer.Meta.fields,
            "group",
            "role",
        )


class GroupRoleAddSerializer(serializers.Serializer):
    """
    Serializer for adding GroupRole.
    """

    role = serializers.PrimaryKeyRelatedField(read_only=True)


class GroupRoleRemoveSerializer(serializers.Serializer):
    """
    Serializer for removing GroupRole.
    """

    role = serializers.PrimaryKeyRelatedField(read_only=True)
