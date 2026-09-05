"""
Publish destination serializers.
"""
from rest_framework import serializers

from apps.publishing.models import PublishDestination


class DestinationListSerializer(serializers.ModelSerializer):
    """Serializer for publish destination list view."""

    type = serializers.CharField(source="destination_type")

    class Meta:
        model = PublishDestination
        fields = (
            "id",
            "name",
            "type",
            "path",
            "protocol",
            "is_default",
            "region",
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
    """Serializer for publish destination detail view."""
