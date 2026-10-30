"""
Localization serializer.
"""
from rest_framework import serializers

from apps.settings.models.localization import Localization


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
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "uuid",
            "created_at",
            "updated_at",
        )

    def validate_week_start(self, value):
        if value not in (0, 1):
            raise serializers.ValidationError("Week start is 0 (Sunday) or 1 (Monday).")
        return value
