"""
Feature Flag serializer.
"""
from rest_framework import serializers

from apps.settings.models.feature_flag import FeatureFlag


class FeatureFlagSerializer(serializers.ModelSerializer[FeatureFlag]):
    """
    Serializer for FeatureFlag.
    """
    
    class Meta:
        model = FeatureFlag
        fields = (
            "id",
            "uuid",
            "code",
            "name",
            "description",
            "feature_type",
            "status",
            "is_enabled",
            "percentage",
            "start_date",
            "end_date",
            "config",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "uuid",
            "is_enabled",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        )

    def validate_percentage(self, value):
        if value < 0 or value > 100:
            raise serializers.ValidationError("Percentage must be between 0 and 100.")
        return value

    def validate(self, attrs):
        start = attrs["start_date"] if "start_date" in attrs else getattr(self.instance, "start_date", None)
        end = attrs["end_date"] if "end_date" in attrs else getattr(self.instance, "end_date", None)
        if start and end and end <= start:
            raise serializers.ValidationError({"end_date": ["End must be after the start."]})
        # ``status`` is the one source of truth for "on"; ``is_enabled`` only follows it.
        status = attrs.get("status", getattr(self.instance, "status", FeatureFlag.STATUS_DISABLED))
        attrs["is_enabled"] = status == FeatureFlag.STATUS_ENABLED
        return attrs
