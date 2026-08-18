"""
Feature Flag serializer.
"""
from rest_framework import serializers

from apps.settings.models.feature_flag import FeatureFlag


class FeatureFlagSerializer(serializers.ModelSerializer):
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
            "organization",
            "config",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "uuid",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        )
