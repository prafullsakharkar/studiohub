"""
Setting Definition model for defining setting schemas with validation.
"""
from __future__ import annotations

import json
from typing import Any

from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models.bases.entity import EntityModel
from apps.core.models.bases.timestamp import TimeStampedModel
from apps.settings.models.category import SettingCategory


class SettingDefinition(EntityModel, TimeStampedModel):
    """
    Definition of a setting with validation rules and metadata.
    
    This model defines the schema for settings, including:
    - Data type and format
    - Validation rules
    - Default values
    - Category organization
    """
    
    # Data type choices
    TYPE_STRING = "string"
    TYPE_INTEGER = "integer"
    TYPE_FLOAT = "float"
    TYPE_BOOLEAN = "boolean"
    TYPE_DATE = "date"
    TYPE_DATETIME = "datetime"
    TYPE_JSON = "json"
    TYPE_TEXT = "text"
    TYPE_EMAIL = "email"
    TYPE_URL = "url"
    TYPE_PHONE = "phone"
    TYPE_COLOR = "color"
    TYPE_SELECT = "select"
    TYPE_MULTIPLE_SELECT = "multiple_select"
    
    TYPE_CHOICES = [
        (TYPE_STRING, _("String")),
        (TYPE_INTEGER, _("Integer")),
        (TYPE_FLOAT, _("Float")),
        (TYPE_BOOLEAN, _("Boolean")),
        (TYPE_DATE, _("Date")),
        (TYPE_DATETIME, _("Datetime")),
        (TYPE_JSON, _("JSON")),
        (TYPE_TEXT, _("Text")),
        (TYPE_EMAIL, _("Email")),
        (TYPE_URL, _("URL")),
        (TYPE_PHONE, _("Phone")),
        (TYPE_COLOR, _("Color")),
        (TYPE_SELECT, _("Select")),
        (TYPE_MULTIPLE_SELECT, _("Multiple Select")),
    ]
    
    # Validation rule choices
    RULE_REQUIRED = "required"
    RULE_MIN_LENGTH = "min_length"
    RULE_MAX_LENGTH = "max_length"
    RULE_MIN_VALUE = "min_value"
    RULE_MAX_VALUE = "max_value"
    RULE_PATTERN = "pattern"
    RULE_CHOICES = "choices"
    RULE_DEPENDS_ON = "depends_on"
    
    RULE_CHOICES_LIST = [
        (RULE_REQUIRED, _("Required")),
        (RULE_MIN_LENGTH, _("Minimum Length")),
        (RULE_MAX_LENGTH, _("Maximum Length")),
        (RULE_MIN_VALUE, _("Minimum Value")),
        (RULE_MAX_VALUE, _("Maximum Value")),
        (RULE_PATTERN, _("Pattern")),
        (RULE_CHOICES, _("Choices")),
        (RULE_DEPENDS_ON, _("Depends On")),
    ]
    
    # Scope choices
    SCOPE_ORGANIZATION = "organization"
    SCOPE_SYSTEM = "system"
    
    SCOPE_CHOICES = [
        (SCOPE_ORGANIZATION, _("Organization")),
        (SCOPE_SYSTEM, _("System")),
    ]
    
    code = models.CharField(
        max_length=100,
        unique=True,
        db_index=True,
        help_text="Unique code for the setting (e.g., 'match.auto_score')",
    )
    
    name = models.CharField(
        max_length=255,
        db_index=True,
        help_text="Display name for the setting",
    )
    
    description = models.TextField(
        blank=True,
        help_text="Description of what this setting does",
    )
    
    category = models.ForeignKey(
        SettingCategory,
        on_delete=models.PROTECT,
        related_name="settings",
        db_index=True,
        help_text="Category this setting belongs to",
    )
    
    data_type = models.CharField(
        max_length=30,
        choices=TYPE_CHOICES,
        default=TYPE_STRING,
        help_text="Data type of the setting value",
    )
    
    scope = models.CharField(
        max_length=20,
        choices=SCOPE_CHOICES,
        default=SCOPE_ORGANIZATION,
        db_index=True,
        help_text="Scope of the setting (organization or system)",
    )
    
    is_required = models.BooleanField(
        default=False,
        help_text="Whether this setting is required",
    )
    
    default_value = models.TextField(
        blank=True,
        help_text="Default value for the setting",
    )
    
    help_text = models.TextField(
        blank=True,
        help_text="Help text to display for this setting",
    )
    
    order = models.PositiveIntegerField(
        default=0,
        db_index=True,
        help_text="Order for displaying settings",
    )
    
    is_active = models.BooleanField(
        default=True,
        db_index=True,
        help_text="Whether this setting definition is active",
    )
    
    # Validation rules stored as JSON
    validation_rules = models.JSONField(
        default=dict,
        blank=True,
        help_text="Validation rules for the setting value",
    )
    
    # Choices for select/multiple_select types
    choices = models.JSONField(
        default=list,
        blank=True,
        help_text="Available choices for select types",
    )
    
    # Dependencies (for conditional settings)
    depends_on = models.CharField(
        max_length=100,
        blank=True,
        help_text="Code of the setting this depends on",
    )
    
    class Meta:
        db_table = "settings_definitions"
        ordering = ("order", "name")
        verbose_name = "Setting Definition"
        verbose_name_plural = "Setting Definitions"
    
    def __str__(self):
        return self.name
    
    @property
    def has_choices(self) -> bool:
        """Check if this setting has predefined choices."""
        return self.data_type in [self.TYPE_SELECT, self.TYPE_MULTIPLE_SELECT]
    
    def get_default_value(self) -> Any:
        """Get the parsed default value."""
        if not self.default_value:
            return None
        
        try:
            return json.loads(self.default_value)
        except (json.JSONDecodeError, TypeError):
            return self.default_value
    
    def validate_value(self, value: Any) -> tuple[bool, list[str]]:
        """
        Validate a setting value against the definition's rules.
        
        Returns:
            Tuple of (is_valid, list_of_errors)
        """
        errors = []
        
        # Check required
        if self.is_required and value is None:
            errors.append(_("This field is required"))
            return False, errors
        
        if value is None:
            return True, []
        
        # Type validation
        if self.data_type == self.TYPE_INTEGER:
            try:
                int(value)
            except (ValueError, TypeError):
                errors.append(_("Must be an integer"))
        
        elif self.data_type == self.TYPE_FLOAT:
            try:
                float(value)
            except (ValueError, TypeError):
                errors.append(_("Must be a number"))
        
        elif self.data_type == self.TYPE_BOOLEAN:
            if not isinstance(value, bool):
                errors.append(_("Must be a boolean"))
        
        elif self.data_type == self.TYPE_STRING:
            if not isinstance(value, str):
                errors.append(_("Must be a string"))
            else:
                if "min_length" in self.validation_rules:
                    if len(value) < self.validation_rules["min_length"]:
                        errors.append(
                            _("Must be at least {length} characters").format(
                                length=self.validation_rules["min_length"]
                            )
                        )
                if "max_length" in self.validation_rules:
                    if len(value) > self.validation_rules["max_length"]:
                        errors.append(
                            _("Must be at most {length} characters").format(
                                length=self.validation_rules["max_length"]
                            )
                        )
        
        # Choices validation
        if self.has_choices and self.choices:
            valid_choices = [str(c["value"]) for c in self.choices]
            if isinstance(value, list):
                invalid = [v for v in value if str(v) not in valid_choices]
                if invalid:
                    errors.append(_("Invalid choices: {values}").format(values=", ".join(invalid)))
            elif str(value) not in valid_choices:
                errors.append(_("Invalid choice: {value}").format(value=value))
        
        return len(errors) == 0, errors
