from rest_framework import serializers

from apps.core.api.serializers.base import BaseReadSerializer, BaseWriteSerializer
from apps.organization.api.serializers.client import validate_organization_ref
from apps.organization.models import Vendor


class VendorSerializer(BaseReadSerializer[Vendor]):
    organization_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = Vendor
        fields = (
            "id",
            "uuid",
            "organization_id",
            "name",
            "code",
            "contact_name",
            "email",
            "specialization",
            "security_tier",
            "nda_signed",
            "active_tasks_count",
            "active_projects",
            "rating",
            "location",
            "status",
            "logo_url",
            "bandwidth_gbps",
            "bandwidth_link",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "uuid", "created_at", "updated_at")


class VendorListSerializer(VendorSerializer):
    pass


class VendorDetailSerializer(VendorSerializer):
    pass


class VendorCreateSerializer(BaseWriteSerializer[Vendor]):
    id = serializers.UUIDField(read_only=True)
    uuid = serializers.UUIDField(read_only=True)

    # Flat organization id accepted by the vendor forms; validated in
    # validate() and assigned server-side by the viewset.
    organization_id = serializers.UUIDField(
        required=False, allow_null=True, write_only=True
    )

    def validate(self, attrs):
        return validate_organization_ref(self, attrs)

    class Meta:
        model = Vendor
        fields = (
            "id",
            "uuid",
            "organization_id",
            "name",
            "code",
            "contact_name",
            "email",
            "specialization",
            "security_tier",
            "nda_signed",
            "active_tasks_count",
            "active_projects",
            "rating",
            "location",
            "status",
            "logo_url",
            "bandwidth_gbps",
            "bandwidth_link",
        )
        read_only_fields = ("id", "uuid")


class VendorUpdateSerializer(BaseWriteSerializer[Vendor]):
    organization_id = serializers.UUIDField(
        required=False, allow_null=True, write_only=True
    )

    def validate(self, attrs):
        return validate_organization_ref(self, attrs)

    class Meta:
        model = Vendor
        fields = (
            "organization_id",
            "name",
            "code",
            "contact_name",
            "email",
            "specialization",
            "security_tier",
            "nda_signed",
            "active_tasks_count",
            "active_projects",
            "rating",
            "location",
            "status",
            "logo_url",
            "bandwidth_gbps",
            "bandwidth_link",
        )
