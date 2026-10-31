"""
Localization serializer.
"""
from rest_framework import serializers

from apps.settings.models.localization import Localization
from apps.settings.services.default_selection import adopt_if_first


class LocalizationSerializer(serializers.ModelSerializer[Localization]):
    """
    Serializer for Localization.
    """
    
    class Meta:
        model = Localization
        fields = (
            "id",
            "uuid",
            "code",
            "name",
            "language",
            "timezone",
            "date_format",
            "time_format",
            "number_format",
            "currency_code",
            "currency_symbol",
            "week_start",
            "fiscal_year_start",
            "is_active",
            "is_default",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "uuid",
            "is_default",
            "created_at",
            "updated_at",
        )

    def validate_week_start(self, value):
        if value not in (0, 1):
            raise serializers.ValidationError("Week start is 0 (Sunday) or 1 (Monday).")
        return value

    def create(self, validated_data):
        # The first active one becomes the default, so there is one whenever there is any to choose from.
        return adopt_if_first(Localization, super().create(validated_data))

    def update(self, instance, validated_data):
        if validated_data.get("is_active") is False and instance.is_default:
            raise serializers.ValidationError(
                {"is_active": ["This is the default and stays active. Make another one the default first."]}
            )
        return super().update(instance, validated_data)
