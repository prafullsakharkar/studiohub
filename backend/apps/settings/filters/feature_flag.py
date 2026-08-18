"""
Feature Flag filter.
"""
from __future__ import annotations

from apps.settings.filters.base import SettingsBaseFilter
from apps.settings.models.feature_flag import FeatureFlag


class FeatureFlagFilter(SettingsBaseFilter):
    """
    Filter for FeatureFlag.
    """

    class Meta:
        model = FeatureFlag
        fields = {
            "code": ["exact", "icontains"],
            "name": ["exact", "icontains"],
            "feature_type": ["exact"],
            "status": ["exact"],
            "is_enabled": ["exact"],
            "organization": ["exact"],
        }
