"""
Publish destination serializers.
"""

from typing import Any

from django.db import transaction
from django.db.models.functions import Upper
from rest_framework import serializers

from apps.publishing.models import PublishDestination


class DestinationListSerializer(serializers.ModelSerializer[PublishDestination]):
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
        # The name and single-default rules are applied below and by the database; DRF's
        # generated validator for the default constraint would refuse "make this the default"
        # before the previous default is cleared.
        validators: list[Any] = []
        extra_kwargs = {"is_default": {"validators": []}}

    def validate_name(self, value):
        """Names are unique in any case among live destinations (migration 0009)."""
        clash = PublishDestination.objects.annotate(uname=Upper("name")).filter(uname=value.upper())
        if self.instance is not None:
            clash = clash.exclude(pk=self.instance.pk)
        if clash.exists():
            raise serializers.ValidationError("A destination with this name already exists.")
        return value

    def validate_type(self, value):
        # One of the seven types (CR-24). A row saved before the check keeps its old value when it is sent back unchanged.
        allowed = [choice for choice, _label in PublishDestination.TYPE_CHOICES]
        if value in allowed or (self.instance is not None and value == self.instance.destination_type):
            return value
        raise serializers.ValidationError(f"Must be one of: {', '.join(allowed)}.")

    @staticmethod
    def _clear_other_defaults(validated_data, *, keep=None):
        """One destination is the default: making one the default clears the previous one."""
        if validated_data.get("is_default"):
            others = PublishDestination.objects.filter(is_default=True)
            if keep is not None:
                others = others.exclude(pk=keep.pk)
            others.update(is_default=False)

    @transaction.atomic
    def create(self, validated_data):
        self._clear_other_defaults(validated_data)
        return super().create(validated_data)

    @transaction.atomic
    def update(self, instance, validated_data):
        self._clear_other_defaults(validated_data, keep=instance)
        return super().update(instance, validated_data)


class DestinationDetailSerializer(DestinationListSerializer):
    """Serializer for publish destination detail view."""
