"""
Delivery destination serializers.
"""

from rest_framework import serializers

from apps.deliveries.models import DeliveryDestination
from apps.deliveries.services.destination import DestinationService


class DestinationListSerializer(serializers.ModelSerializer[DeliveryDestination]):
    """Serializer for delivery destination list view."""

    type = serializers.CharField(source="destination_type")
    # Declared so DRF does not turn the "one live default" constraint into a validator that would
    # refuse a new default before the service can move the old one (DestinationService).
    is_default = serializers.BooleanField(required=False)
    # Frontend contract aliases (write-only): the UI posts `rate`/`region`
    # instead of `transfer_rate_mbps`/`storage_region`.
    rate = serializers.IntegerField(write_only=True, required=False, min_value=0, allow_null=True)
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

    def validate_type(self, value):
        # One of the seven types (CR-19). A row saved before the check keeps its old value when it is sent back unchanged.
        allowed = [choice for choice, _label in DeliveryDestination.TYPE_CHOICES]
        if value in allowed or (self.instance is not None and value == self.instance.destination_type):
            return value
        raise serializers.ValidationError(f"Must be one of: {', '.join(allowed)}.")

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

    def _actor(self):
        request = self.context.get("request")
        return getattr(request, "user", None)

    def create(self, validated_data):
        return DestinationService.create(
            actor=self._actor(), data=self._apply_aliases(validated_data)
        )

    def update(self, instance, validated_data):
        return DestinationService.update(
            actor=self._actor(), destination=instance, data=self._apply_aliases(validated_data)
        )


class DestinationDetailSerializer(DestinationListSerializer):
    """Serializer for delivery destination detail view."""
