from rest_framework import serializers

from apps.core.api.serializers.base import BaseReadSerializer, BaseWriteSerializer
from apps.organization.api.serializers.client import (
    validate_organization_ref,
    validate_relation_ref,
)
from apps.organization.models import Vendor, VendorContact


class VendorContactSerializer(BaseReadSerializer[VendorContact]):
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


class VendorContactCreateSerializer(BaseWriteSerializer[VendorContact]):
    id = serializers.UUIDField(read_only=True)
    uuid = serializers.UUIDField(read_only=True)

    # Flat relation ids accepted by the contact forms; validated in
    # validate(). Organization and vendor stay assigned server-side from
    # the nested URL (see VendorContactViewSet).
    organization_id = serializers.UUIDField(
        required=False, allow_null=True, write_only=True
    )
    vendor_id = serializers.UUIDField(required=False, allow_null=True, write_only=True)

    def validate(self, attrs):
        attrs = validate_organization_ref(self, attrs)
        return validate_relation_ref(self, attrs, "vendor_id", Vendor)

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
        )
        read_only_fields = ("id", "uuid")


class VendorContactUpdateSerializer(BaseWriteSerializer[VendorContact]):
    organization_id = serializers.UUIDField(
        required=False, allow_null=True, write_only=True
    )
    vendor_id = serializers.UUIDField(required=False, allow_null=True, write_only=True)

    def validate(self, attrs):
        attrs = validate_organization_ref(self, attrs)
        return validate_relation_ref(self, attrs, "vendor_id", Vendor)

    class Meta:
        model = VendorContact
        fields = (
            "organization_id",
            "vendor_id",
            "name",
            "role",
            "email",
            "phone",
            "timezone",
            "is_primary",
        )
