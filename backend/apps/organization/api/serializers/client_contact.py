from rest_framework import serializers

from apps.core.api.serializers.base import BaseReadSerializer, BaseWriteSerializer
from apps.organization.api.serializers.client import (
    validate_organization_ref,
    validate_relation_ref,
)
from apps.organization.models import Client, ClientContact


class ClientContactSerializer(BaseReadSerializer[ClientContact]):
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


class ClientContactCreateSerializer(BaseWriteSerializer[ClientContact]):
    id = serializers.UUIDField(read_only=True)
    uuid = serializers.UUIDField(read_only=True)

    # Flat relation ids accepted by the contact forms; validated in
    # validate(). Organization and client stay assigned server-side from
    # the nested URL (see ClientContactViewSet).
    organization_id = serializers.UUIDField(
        required=False, allow_null=True, write_only=True
    )
    client_id = serializers.UUIDField(required=False, allow_null=True, write_only=True)

    def validate(self, attrs):
        attrs = validate_organization_ref(self, attrs)
        return validate_relation_ref(self, attrs, "client_id", Client)

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
        )
        read_only_fields = ("id", "uuid")


class ClientContactUpdateSerializer(BaseWriteSerializer[ClientContact]):
    organization_id = serializers.UUIDField(
        required=False, allow_null=True, write_only=True
    )
    client_id = serializers.UUIDField(required=False, allow_null=True, write_only=True)

    def validate(self, attrs):
        attrs = validate_organization_ref(self, attrs)
        return validate_relation_ref(self, attrs, "client_id", Client)

    class Meta:
        model = ClientContact
        fields = (
            "organization_id",
            "client_id",
            "name",
            "role",
            "email",
            "phone",
            "timezone",
            "portal_access",
            "is_primary",
        )
