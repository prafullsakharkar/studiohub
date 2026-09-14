"""
Delivery destination serializers.
"""
from rest_framework import serializers

from apps.deliveries.models import DeliveryDestination


class DestinationListSerializer(serializers.ModelSerializer[DeliveryDestination]):
    """Serializer for delivery destination list view."""

    type = serializers.CharField(source="destination_type")
    # Frontend contract aliases (write-only): the UI posts `rate`/`region`
    # instead of `transfer_rate_mbps`/`storage_region`.
    rate = serializers.IntegerField(
        write_only=True, required=False, min_value=0, allow_null=True
    )
    region = serializers.CharField(
        write_only=True, required=False, allow_blank=True, max_length=255
    )

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
            "rate",
            "region",
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

    def _apply_aliases(self, validated_data):
        if "rate" in validated_data:
            rate = validated_data.pop("rate")
            if rate is not None:
                validated_data["transfer_rate_mbps"] = rate
        if "region" in validated_data:
            region = validated_data.pop("region")
            if region:
                validated_data["storage_region"] = region
        return validated_data

    def create(self, validated_data):
        return super().create(self._apply_aliases(validated_data))

    def update(self, instance, validated_data):
        return super().update(instance, self._apply_aliases(validated_data))


class DestinationDetailSerializer(DestinationListSerializer):
    """Serializer for delivery destination detail view."""
