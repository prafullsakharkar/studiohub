from rest_framework import serializers

from apps.organization.api.serializers.base import OrganizationEntitySerializer
from apps.organization.models import Group


class GroupBaseSerializer(OrganizationEntitySerializer):
    """
    Base serializer for Group.
    """

    class Meta(OrganizationEntitySerializer.Meta):
        model = Group

        fields = (
            *OrganizationEntitySerializer.Meta.fields,
            "code",
            "name",
            "description",
            "is_system",
            "color",
        )

        read_only_fields = (
            *OrganizationEntitySerializer.Meta.read_only_fields,
            "code",
        )


class GroupCreateSerializer(GroupBaseSerializer):
    """
    Serializer for creating Group.
    """

    class Meta(GroupBaseSerializer.Meta):
        read_only_fields = (
            *GroupBaseSerializer.Meta.read_only_fields,
            "organization",
        )


class GroupUpdateSerializer(GroupBaseSerializer):
    """
    Serializer for updating Group.
    """

    class Meta(GroupBaseSerializer.Meta):
        read_only_fields = (
            *GroupBaseSerializer.Meta.read_only_fields,
            "code",
        )


class GroupListSerializer(GroupBaseSerializer):
    """
    Serializer for listing Group.
    """

    organization_name = serializers.CharField(source="organization.name", read_only=True)
    member_count = serializers.IntegerField(read_only=True)
    role_count = serializers.IntegerField(read_only=True)

    class Meta(GroupBaseSerializer.Meta):
        fields = (
            *GroupBaseSerializer.Meta.fields,
            "organization_name",
            "member_count",
            "role_count",
        )


class GroupDetailSerializer(GroupBaseSerializer):
    """
    Serializer for retrieving Group details.
    """

    organization_name = serializers.CharField(source="organization.name", read_only=True)
    members = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    roles = serializers.PrimaryKeyRelatedField(many=True, read_only=True)

    class Meta(GroupBaseSerializer.Meta):
        fields = (
            *GroupBaseSerializer.Meta.fields,
            "organization_name",
            "members",
            "roles",
        )


class GroupMemberSerializer(serializers.Serializer):
    """
    Serializer for Group member operations.
    """

    user = serializers.PrimaryKeyRelatedField(read_only=True)
    is_owner = serializers.BooleanField(default=False)
    is_manager = serializers.BooleanField(default=False)


class GroupRoleSerializer(serializers.Serializer):
    """
    Serializer for Group role operations.
    """

    role = serializers.PrimaryKeyRelatedField(read_only=True)
