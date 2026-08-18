from rest_framework import serializers

from apps.organization.api.serializers.base import OrganizationEntitySerializer
from apps.organization.models import APIKey


class APIKeyBaseSerializer(OrganizationEntitySerializer):
    """
    Base serializer for APIKey.
    """

    class Meta(OrganizationEntitySerializer.Meta):
        model = APIKey

        fields = (
            "id",
            "uuid",
            "name",
            "description",
            "organization",
            "prefix",
            "hashed_key",
            "owner",
            "created_by",
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
            "hashed_key",
            "last_used_at",
            "last_used_ip",
        )


class APIKeyCreateSerializer(APIKeyBaseSerializer):
    """
    Serializer for creating APIKey.
    """

    class Meta(APIKeyBaseSerializer.Meta):
        read_only_fields = (
            *APIKeyBaseSerializer.Meta.read_only_fields,
            "organization",
            "created_by",
        )


class APIKeyUpdateSerializer(APIKeyBaseSerializer):
    """
    Serializer for updating APIKey.
    """

    class Meta(APIKeyBaseSerializer.Meta):
        read_only_fields = (
            *APIKeyBaseSerializer.Meta.read_only_fields,
            "prefix",
            "hashed_key",
            "owner",
            "created_by",
        )


class APIKeyListSerializer(APIKeyBaseSerializer):
    """
    Serializer for listing APIKey.
    """

    owner_name = serializers.CharField(source="owner.get_full_name", read_only=True)
    owner_email = serializers.EmailField(source="owner.email", read_only=True)
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True)
    created_by_email = serializers.EmailField(source="created_by.email", read_only=True)
    organization_name = serializers.CharField(source="organization.name", read_only=True)

    class Meta(APIKeyBaseSerializer.Meta):
        fields = (
            *APIKeyBaseSerializer.Meta.fields,
            "owner_name",
            "owner_email",
            "created_by_name",
            "created_by_email",
            "organization_name",
        )


class APIKeyDetailSerializer(APIKeyBaseSerializer):
    """
    Serializer for retrieving APIKey details.
    """

    owner_name = serializers.CharField(source="owner.get_full_name", read_only=True)
    owner_email = serializers.EmailField(source="owner.email", read_only=True)
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True)
    created_by_email = serializers.EmailField(source="created_by.email", read_only=True)
    organization_name = serializers.CharField(source="organization.name", read_only=True)

    class Meta(APIKeyBaseSerializer.Meta):
        fields = (
            *APIKeyBaseSerializer.Meta.fields,
            "owner_name",
            "owner_email",
            "created_by_name",
            "created_by_email",
            "organization_name",
        )
