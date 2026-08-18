"""
Localization serializer.
"""
from rest_framework import serializers

from apps.settings.models.localization import Localization


class LocalizationSerializer(serializers.ModelSerializer):
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
            "organization",
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
