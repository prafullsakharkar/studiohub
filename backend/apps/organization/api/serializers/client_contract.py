from rest_framework import serializers

from apps.core.api.serializers.base import BaseReadSerializer, BaseWriteSerializer
from apps.organization.api.serializers.client import (
    validate_organization_ref,
    validate_relation_ref,
)
from apps.organization.models import Client, ClientContract


class ClientContractSerializer(BaseReadSerializer[ClientContract]):
    organization_id = serializers.UUIDField(read_only=True)
    client_id = serializers.UUIDField(source="client.id", read_only=True)

    class Meta:
        model = ClientContract
        fields = (
            "id",
            "uuid",
            "organization_id",
            "client_id",
            "contract_number",
            "title",
            "type",
            "effective_date",
            "expiry_date",
            "value_usd",
            "status",
            "nda_signed",
            "document_url",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "uuid", "created_at", "updated_at")


class ClientContractListSerializer(ClientContractSerializer):
    pass


class ClientContractDetailSerializer(ClientContractSerializer):
    pass


class ClientContractCreateSerializer(BaseWriteSerializer[ClientContract]):
    id = serializers.UUIDField(read_only=True)
    uuid = serializers.UUIDField(read_only=True)

    # Flat relation ids accepted by the contract forms; validated in
    # validate(). Organization and client stay assigned server-side from
    # the nested URL (see ClientContractViewSet).
    organization_id = serializers.UUIDField(
        required=False, allow_null=True, write_only=True
    )
    client_id = serializers.UUIDField(required=False, allow_null=True, write_only=True)

    def validate(self, attrs):
        attrs = validate_organization_ref(self, attrs)
        return validate_relation_ref(self, attrs, "client_id", Client)

    class Meta:
        model = ClientContract
        fields = (
            "id",
            "uuid",
            "organization_id",
            "client_id",
            "contract_number",
            "title",
            "type",
            "effective_date",
            "expiry_date",
            "value_usd",
            "status",
            "nda_signed",
            "document_url",
        )
        read_only_fields = ("id", "uuid")


class ClientContractUpdateSerializer(BaseWriteSerializer[ClientContract]):
    organization_id = serializers.UUIDField(
        required=False, allow_null=True, write_only=True
    )
    client_id = serializers.UUIDField(required=False, allow_null=True, write_only=True)

    def validate(self, attrs):
        attrs = validate_organization_ref(self, attrs)
        return validate_relation_ref(self, attrs, "client_id", Client)

    class Meta:
        model = ClientContract
        fields = (
            "organization_id",
            "client_id",
            "contract_number",
            "title",
            "type",
            "effective_date",
            "expiry_date",
            "value_usd",
            "status",
            "nda_signed",
            "document_url",
        )
