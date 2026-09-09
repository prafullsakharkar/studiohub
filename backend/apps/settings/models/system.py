"""
System Setting model for system-wide settings.
"""
from __future__ import annotations

from django.db import models

from apps.core.models.bases.entity import EntityModel
from apps.core.models.bases.timestamp import TimeStampedModel
from apps.settings.models.definition import SettingDefinition


class SystemSetting(EntityModel, TimeStampedModel):
    """
    System-wide setting value.
    
    Stores the actual value of a system-level setting that applies
    across all organizations.
    """
    
    setting = models.ForeignKey(
        SettingDefinition,
        on_delete=models.CASCADE,
        related_name="system_values",
        db_index=True,
        help_text="The setting definition",
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
        related_name="locked_system_settings",
        help_text="User who locked this setting",
    )
    
    locked_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When this setting was locked",
    )
    
    class Meta:
        db_table = "system_settings"
        ordering = ("setting__name",)
        verbose_name = "System Setting"
        verbose_name_plural = "System Settings"
        unique_together = ("setting",)
    
    def __str__(self):
        return f"System: {self.setting.name}"
    
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
