from rest_framework import serializers

from apps.core.api.serializers.base import BaseReadSerializer, BaseWriteSerializer
from apps.organization.models import ClientContact


class ClientContactSerializer(BaseReadSerializer):
    organization_id = serializers.UUIDField(read_only=True)
    client_id = serializers.UUIDField(source="client.id", read_only=True)

    class Meta:
        model = ClientContact
        fields = (
            "id",
            "uuid",
            "organization_id",
            "client_id",
            "name",
            "role",
            "email",
            "phone",
            "timezone",
            "portal_access",
            "is_primary",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "uuid", "created_at", "updated_at")


class ClientContactListSerializer(ClientContactSerializer):
    pass


class ClientContactDetailSerializer(ClientContactSerializer):
    pass


class ClientContactCreateSerializer(BaseWriteSerializer):
    id = serializers.UUIDField(read_only=True)
    uuid = serializers.UUIDField(read_only=True)

    class Meta:
        model = ClientContact
        fields = (
            "id",
            "uuid",
            "name",
            "role",
            "email",
            "phone",
            "timezone",
            "portal_access",
            "is_primary",
        )
        read_only_fields = ("id", "uuid")


class ClientContactUpdateSerializer(BaseWriteSerializer):
    class Meta:
        model = ClientContact
        fields = (
            "name",
            "role",
            "email",
            "phone",
            "timezone",
            "portal_access",
            "is_primary",
        )
