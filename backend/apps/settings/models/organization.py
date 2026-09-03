"""
Organization Setting model for organization-specific settings.
"""
from __future__ import annotations

from django.db import models

from apps.core.models.bases.entity import EntityModel
from apps.core.models.bases.timestamp import TimeStampedModel
from apps.organization.models.organization import Organization
from apps.settings.models.definition import SettingDefinition


class OrganizationSetting(EntityModel, TimeStampedModel):
    """
    Organization-specific setting value.
    
    Stores the actual value of a setting for a specific organization.
    """
    
    setting = models.ForeignKey(
        SettingDefinition,
        on_delete=models.CASCADE,
        related_name="organization_values",
        db_index=True,
        help_text="The setting definition",
    )
    
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="settings",
        db_index=True,
        help_text="The organization",
    )
    
    value = models.TextField(
        blank=True,
        help_text="The setting value (stored as JSON string)",
    )
    
    is_locked = models.BooleanField(
        default=False,
        help_text="Whether this setting is locked (cannot be changed)",
    )
    
    locked_by = models.ForeignKey(
        "identity.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="locked_organization_settings",
        help_text="User who locked this setting",
    )
    
    locked_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When this setting was locked",
    )
    
    class Meta:
        db_table = "organization_settings"
        ordering = ("setting__name",)
        verbose_name = "Organization Setting"
        verbose_name_plural = "Organization Settings"
        unique_together = ("setting", "organization")
    
    def __str__(self):
        return f"{self.organization.name}: {self.setting.name}"
    
    @property
    def value_parsed(self):
        """Parse the stored value to Python object."""
        if not self.value:
            return None
        
        try:
            import json
            return json.loads(self.value)
        except (json.JSONDecodeError, TypeError):
            return self.value
    
    def set_value(self, value):
        """Set the value and store as JSON string."""
        import json
        self.value = json.dumps(value)
