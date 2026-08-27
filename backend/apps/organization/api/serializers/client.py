from rest_framework import serializers
from apps.core.api.serializers.base import BaseReadSerializer, BaseWriteSerializer
from apps.organization.models import Client


class ClientSerializer(BaseReadSerializer):
    organization_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = Client
        fields = (
            "id",
            "uuid",
            "organization_id",
            "name",
            "code",
            "contact_name",
            "email",
            "phone",
            "studio_type",
            "active_projects",
            "contract_tier",
            "portal_access",
            "status",
            "logo_url",
            "headquarters",
            "total_billed_usd",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "uuid", "created_at", "updated_at")


class ClientListSerializer(ClientSerializer):
    pass


class ClientDetailSerializer(ClientSerializer):
    pass


class ClientCreateSerializer(BaseWriteSerializer):
    id = serializers.UUIDField(read_only=True)
    uuid = serializers.UUIDField(read_only=True)

    class Meta:
        model = Client
        fields = (
            "id",
            "uuid",
            "name",
            "code",
            "contact_name",
            "email",
            "phone",
            "studio_type",
            "active_projects",
            "contract_tier",
            "portal_access",
            "status",
            "logo_url",
            "headquarters",
            "total_billed_usd",
        )
        read_only_fields = ("id", "uuid")


class ClientUpdateSerializer(BaseWriteSerializer):
    class Meta:
        model = Client
        fields = (
            "name",
            "code",
            "contact_name",
            "email",
            "phone",
            "studio_type",
            "active_projects",
            "contract_tier",
            "portal_access",
            "status",
            "logo_url",
            "headquarters",
            "total_billed_usd",
        )
