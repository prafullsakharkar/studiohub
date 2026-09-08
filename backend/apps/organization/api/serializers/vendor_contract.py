from rest_framework import serializers

from apps.core.api.serializers.base import BaseReadSerializer, BaseWriteSerializer
from apps.organization.models import VendorContract


class VendorContractSerializer(BaseReadSerializer[VendorContract]):
    organization_id = serializers.UUIDField(read_only=True)
    vendor_id = serializers.UUIDField(source="vendor.id", read_only=True)

    class Meta:
        model = VendorContract
        fields = (
            "id",
            "uuid",
            "organization_id",
            "vendor_id",
            "contract_number",
            "title",
            "type",
            "effective_date",
            "expiry_date",
            "total_value_usd",
            "nda_signed",
            "security_tier",
            "status",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "uuid", "created_at", "updated_at")


class VendorContractListSerializer(VendorContractSerializer):
    pass


class VendorContractDetailSerializer(VendorContractSerializer):
    pass


class VendorContractCreateSerializer(BaseWriteSerializer[VendorContract]):
    id = serializers.UUIDField(read_only=True)
    uuid = serializers.UUIDField(read_only=True)

    class Meta:
        model = VendorContract
        fields = (
            "id",
            "uuid",
            "contract_number",
            "title",
            "type",
            "effective_date",
            "expiry_date",
            "total_value_usd",
            "nda_signed",
            "security_tier",
            "status",
        )
        read_only_fields = ("id", "uuid")


class VendorContractUpdateSerializer(BaseWriteSerializer[VendorContract]):
    class Meta:
        model = VendorContract
        fields = (
            "contract_number",
            "title",
            "type",
            "effective_date",
            "expiry_date",
            "total_value_usd",
            "nda_signed",
            "security_tier",
            "status",
        )
