from rest_framework import serializers

from apps.core.api.serializers.base import BaseReadSerializer, BaseWriteSerializer
from apps.organization.models import VendorContact


class VendorContactSerializer(BaseReadSerializer):
    organization_id = serializers.UUIDField(read_only=True)
    vendor_id = serializers.UUIDField(source="vendor.id", read_only=True)

    class Meta:
        model = VendorContact
        fields = (
            "id",
            "uuid",
            "organization_id",
            "vendor_id",
            "name",
            "role",
            "email",
            "phone",
            "timezone",
            "is_primary",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "uuid", "created_at", "updated_at")


class VendorContactListSerializer(VendorContactSerializer):
    pass


class VendorContactDetailSerializer(VendorContactSerializer):
    pass


class VendorContactCreateSerializer(BaseWriteSerializer):
    id = serializers.UUIDField(read_only=True)
    uuid = serializers.UUIDField(read_only=True)

    class Meta:
        model = VendorContact
        fields = (
            "id",
            "uuid",
            "name",
            "role",
            "email",
            "phone",
            "timezone",
            "is_primary",
        )
        read_only_fields = ("id", "uuid")


class VendorContactUpdateSerializer(BaseWriteSerializer):
    class Meta:
        model = VendorContact
        fields = (
            "name",
            "role",
            "email",
            "phone",
            "timezone",
            "is_primary",
        )
