from rest_framework import serializers

from apps.organization.api.serializers.base import OrganizationEntitySerializer
from apps.organization.models import PersonalAccessToken


class PersonalAccessTokenBaseSerializer(OrganizationEntitySerializer):
    """
    Base serializer for PersonalAccessToken.
    """

    class Meta(OrganizationEntitySerializer.Meta):
        model = PersonalAccessToken

        fields = (
            "id",
            "uuid",
            "user",
            "name",
            "prefix",
            "hashed_token",
            "scopes",
            "expires_at",
            "last_used_at",
            "last_used_ip",
            "is_active",
            "created_at",
            "updated_at",
        )

        read_only_fields = (
            *OrganizationEntitySerializer.Meta.read_only_fields,
            "prefix",
            "hashed_token",
            "last_used_at",
            "last_used_ip",
        )


class PersonalAccessTokenCreateSerializer(PersonalAccessTokenBaseSerializer):
    """
    Serializer for creating PersonalAccessToken.
    """

    class Meta(PersonalAccessTokenBaseSerializer.Meta):
        read_only_fields = (
            *PersonalAccessTokenBaseSerializer.Meta.read_only_fields,
            "user",
        )


class PersonalAccessTokenUpdateSerializer(PersonalAccessTokenBaseSerializer):
    """
    Serializer for updating PersonalAccessToken.
    """

    class Meta(PersonalAccessTokenBaseSerializer.Meta):
        read_only_fields = (
            *PersonalAccessTokenBaseSerializer.Meta.read_only_fields,
            "prefix",
            "hashed_token",
            "user",
        )


class PersonalAccessTokenListSerializer(PersonalAccessTokenBaseSerializer):
    """
    Serializer for listing PersonalAccessToken.
    """

    user_name = serializers.CharField(source="user.get_full_name", read_only=True)
    user_email = serializers.EmailField(source="user.email", read_only=True)

    class Meta(PersonalAccessTokenBaseSerializer.Meta):
        fields = (
            *PersonalAccessTokenBaseSerializer.Meta.fields,
            "user_name",
            "user_email",
        )


class PersonalAccessTokenDetailSerializer(PersonalAccessTokenBaseSerializer):
    """
    Serializer for retrieving PersonalAccessToken details.
    """

    user_name = serializers.CharField(source="user.get_full_name", read_only=True)
    user_email = serializers.EmailField(source="user.email", read_only=True)

    class Meta(PersonalAccessTokenBaseSerializer.Meta):
        fields = (
            *PersonalAccessTokenBaseSerializer.Meta.fields,
            "user_name",
            "user_email",
        )
