from rest_framework import serializers

from apps.organization.api.serializers.base import OrganizationEntitySerializer
from apps.organization.models import GroupMember


class GroupMemberBaseSerializer(OrganizationEntitySerializer):
    """
    Base serializer for GroupMember.
    """

    class Meta(OrganizationEntitySerializer.Meta):
        model = GroupMember

        fields = (
            "id",
            "uuid",
            "group",
            "user",
            "is_owner",
            "is_manager",
            "joined_at",
            "left_at",
            "created_at",
            "updated_at",
        )

        read_only_fields = (
            *OrganizationEntitySerializer.Meta.read_only_fields,
            "group",
            "user",
            "joined_at",
            "left_at",
        )


class GroupMemberCreateSerializer(GroupMemberBaseSerializer):
    """
    Serializer for creating GroupMember.
    """

    class Meta(GroupMemberBaseSerializer.Meta):
        read_only_fields = (
            *GroupMemberBaseSerializer.Meta.read_only_fields,
            "organization",
        )


class GroupMemberUpdateSerializer(GroupMemberBaseSerializer):
    """
    Serializer for updating GroupMember.
    """

    class Meta(GroupMemberBaseSerializer.Meta):
        read_only_fields = (
            *GroupMemberBaseSerializer.Meta.read_only_fields,
            "group",
            "user",
            "joined_at",
        )


class GroupMemberListSerializer(GroupMemberBaseSerializer):
    """
    Serializer for listing GroupMember.
    """

    group_name = serializers.CharField(source="group.name", read_only=True)
    user_name = serializers.CharField(source="user.get_full_name", read_only=True)
    user_email = serializers.EmailField(source="user.email", read_only=True)

    class Meta(GroupMemberBaseSerializer.Meta):
        fields = (
            *GroupMemberBaseSerializer.Meta.fields,
            "group_name",
            "user_name",
            "user_email",
        )


class GroupMemberDetailSerializer(GroupMemberBaseSerializer):
    """
    Serializer for retrieving GroupMember details.
    """

    group = serializers.PrimaryKeyRelatedField(read_only=True)
    user = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta(GroupMemberBaseSerializer.Meta):
        fields = (
            *GroupMemberBaseSerializer.Meta.fields,
            "group",
            "user",
        )


class GroupMemberAddSerializer(serializers.Serializer):
    """
    Serializer for adding GroupMember.
    """

    user = serializers.PrimaryKeyRelatedField(read_only=True)
    is_owner = serializers.BooleanField(default=False)
    is_manager = serializers.BooleanField(default=False)


class GroupMemberRemoveSerializer(serializers.Serializer):
    """
    Serializer for removing GroupMember.
    """

    user = serializers.PrimaryKeyRelatedField(read_only=True)
