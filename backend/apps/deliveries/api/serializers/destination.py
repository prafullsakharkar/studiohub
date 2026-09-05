"""
Delivery destination serializers.
"""
from rest_framework import serializers

from apps.deliveries.models import DeliveryDestination


class DestinationListSerializer(serializers.ModelSerializer):
    """Serializer for delivery destination list view."""

    type = serializers.CharField(source="destination_type")

    class Meta:
        model = DeliveryDestination
        fields = (
            "id",
            "name",
            "type",
            "endpoint",
            "credentials_configured",
            "transfer_rate_mbps",
            "storage_region",
            "port",
            "target_directory",
            "is_default",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "created_at",
            "updated_at",
        )


class DestinationDetailSerializer(DestinationListSerializer):
    """Serializer for delivery destination detail view."""
