"""
Feature Flag model for feature flag management.
"""
from __future__ import annotations

from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models.bases.entity import EntityModel
from apps.core.models.bases.timestamp import TimeStampedModel
from apps.organization.models.organization import Organization


class FeatureFlag(EntityModel, TimeStampedModel):
    """
    Feature flag for enabling/disabling features.
    
    Supports multiple scopes:
    - Organization: Enable for specific organizations
    - User: Enable for specific users
    - System: Global feature flag
    """
    
    # Feature flag types
    TYPE_BOOLEAN = "boolean"
    TYPE_PERCENTAGE = "percentage"
    TYPE_SCHEDULED = "scheduled"
    TYPE_ROLLOUT = "rollout"
    
    TYPE_CHOICES = [
        (TYPE_BOOLEAN, _("Boolean")),
        (TYPE_PERCENTAGE, _("Percentage")),
        (TYPE_SCHEDULED, _("Scheduled")),
        (TYPE_ROLLOUT, _("Rollout")),
    ]
    
    # Status choices
    STATUS_ENABLED = "enabled"
    STATUS_DISABLED = "disabled"
    STATUS_SCHEDULED = "scheduled"
    STATUS_EXPIRED = "expired"
    
    STATUS_CHOICES = [
        (STATUS_ENABLED, _("Enabled")),
        (STATUS_DISABLED, _("Disabled")),
        (STATUS_SCHEDULED, _("Scheduled")),
        (STATUS_EXPIRED, _("Expired")),
    ]
    
    code = models.CharField(
        max_length=100,
        unique=True,
        db_index=True,
        help_text="Unique code for the feature flag",
    )
    
    name = models.CharField(
        max_length=255,
        db_index=True,
        help_text="Display name for the feature flag",
    )
    
    description = models.TextField(
        blank=True,
        help_text="Description of what this feature does",
    )
    
    feature_type = models.CharField(
        max_length=20,
        choices=TYPE_CHOICES,
        default=TYPE_BOOLEAN,
        help_text="Type of feature flag",
    )
    
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_DISABLED,
        db_index=True,
        help_text="Current status of the feature flag",
    )
    
    # Boolean flag
    is_enabled = models.BooleanField(
        default=False,
        help_text="Whether the feature is enabled",
    )
    
    # Percentage rollout (0-100)
    percentage = models.PositiveSmallIntegerField(
        default=0,
        help_text="Percentage of users to enable this feature for",
    )
    
    # Scheduled rollout
    start_date = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When to enable this feature",
    )
    
    end_date = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When to disable this feature",
    )
    
    # Organization scope
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="feature_flags",
        null=True,
        blank=True,
        db_index=True,
        help_text="Organization to enable this feature for (null = system-wide)",
    )
    
    # Additional configuration
    config = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional configuration for the feature flag",
    )
    
    created_by = models.ForeignKey(
        "identity.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_feature_flags",
        help_text="User who created this feature flag",
    )
    
    updated_by = models.ForeignKey(
        "identity.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updated_feature_flags",
        help_text="User who last updated this feature flag",
    )
    
    class Meta:
        db_table = "feature_flags"
        ordering = ("name",)
        verbose_name = "Feature Flag"
        verbose_name_plural = "Feature Flags"
        unique_together = ("code", "organization")
    
    def __str__(self):
        return self.name
    
    @property
    def is_active(self) -> bool:
        """Check if the feature flag is currently active."""
        if self.status == self.STATUS_DISABLED:
            return False
        
        if self.status == self.STATUS_ENABLED:
            return True
        
        if self.status == self.STATUS_SCHEDULED:
            from django.utils import timezone
            now = timezone.now()
            return self.start_date <= now <= (self.end_date or now)
        
        if self.status == self.STATUS_EXPIRED:
            return False
        
        return False
    
    def is_enabled_for_organization(self, organization: Organization) -> bool:
        """Check if the feature is enabled for a specific organization."""
        if self.organization and self.organization != organization:
            return False
        
        if not self.is_active:
            return False
        
        if self.feature_type == self.TYPE_BOOLEAN:
            return self.is_enabled
        
        if self.feature_type == self.TYPE_PERCENTAGE:
            # Stable hash-based percentage check (``hash()`` is salted per
            # process, which would make rollouts non-deterministic across
            # workers).
            import hashlib

            digest = hashlib.sha256(
                str(organization.id).encode(),
            ).hexdigest()

            hash_value = int(digest[:8], 16) % 100
            return hash_value < self.percentage
        
        return False
