from typing import Any

from rest_framework import serializers

from apps.core.api.serializers.base import BaseWriteSerializer
from apps.production.models import Timelog


class TimelogUpdateSerializer(BaseWriteSerializer[Any]):
    class Meta:
        model = Timelog
        fields = (
            "department",
            "duration_hours",
            "date",
            "billable",
            "notes",
            "status",
            "activity_category",
            "hourly_rate_usd",
        )

    def validate_duration_hours(self, value):
        """An adjustment may be negative (never zero); an ordinary entry is time worked, so it is positive."""
        corrects_another = bool(getattr(self.instance, "adjustment_of_id", None))
        if corrects_another and value == 0:
            raise serializers.ValidationError("An adjustment cannot be zero.")
        if not corrects_another and value <= 0:
            raise serializers.ValidationError(
                "Hours must be greater than zero. Correct an approved entry with an adjustment."
            )
        return value
