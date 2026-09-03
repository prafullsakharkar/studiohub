from rest_framework import serializers

from apps.core.api.serializers.base import BaseReadSerializer, BaseWriteSerializer
from apps.organization.models import Vendor


class VendorSerializer(BaseReadSerializer):
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


class VendorCreateSerializer(BaseWriteSerializer):
    id = serializers.UUIDField(read_only=True)
    uuid = serializers.UUIDField(read_only=True)

    class Meta:
        model = Vendor
        fields = (
            "id",
            "uuid",
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


class VendorUpdateSerializer(BaseWriteSerializer):
    class Meta:
        model = Vendor
        fields = (
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
