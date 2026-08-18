"""
Feature Flag choices.
"""
from __future__ import annotations

from django.db import models
from django.utils.translation import gettext_lazy as _


class FeatureFlagType(models.TextChoices):
    """
    Feature flag types.
    """
    
    BOOLEAN = "boolean", _("Boolean")
    PERCENTAGE = "percentage", _("Percentage")
    SCHEDULED = "scheduled", _("Scheduled")
    ROLLOUT = "rollout", _("Rollout")


class FeatureFlagStatus(models.TextChoices):
    """
    Feature flag status.
    """
    
    ENABLED = "enabled", _("Enabled")
    DISABLED = "disabled", _("Disabled")
    SCHEDULED = "scheduled", _("Scheduled")
    EXPIRED = "expired", _("Expired")
