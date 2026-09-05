"""
Setting Category model for organizing settings into logical groups.
"""
from __future__ import annotations

from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models.bases.entity import EntityModel
from apps.core.models.bases.timestamp import TimeStampedModel


class SettingCategory(EntityModel, TimeStampedModel):
    """
    Category for organizing settings.
    
    Categories help group related settings together for better organization
    and user interface grouping.
    """
    
    # Category codes for standard categories
    GENERAL = "general"
    PROJECT = "project"
    MEDIA = "media"
    WORKFLOW = "workflow"
    REVIEW = "review"
    DELIVERY = "delivery"
    NOTIFICATION = "notification"
    BILLING = "billing"
    BRANDING = "branding"
    ANALYTICS = "analytics"
    AI = "ai"
    LOCALIZATION = "localization"
    THEME = "theme"
    SECURITY = "security"

    CATEGORY_CHOICES = [
        (GENERAL, _("General")),
        (PROJECT, _("Project")),
        (MEDIA, _("Media")),
        (WORKFLOW, _("Workflow")),
        (REVIEW, _("Review")),
        (DELIVERY, _("Delivery")),
        (NOTIFICATION, _("Notification")),
        (BILLING, _("Billing")),
        (BRANDING, _("Branding")),
        (ANALYTICS, _("Analytics")),
        (AI, _("AI")),
        (LOCALIZATION, _("Localization")),
        (THEME, _("Theme")),
        (SECURITY, _("Security")),
    ]
    
    code = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        choices=CATEGORY_CHOICES,
        help_text="Unique code for the category",
    )
    
    name = models.CharField(
        max_length=255,
        db_index=True,
        help_text="Display name for the category",
    )
    
    description = models.TextField(
        blank=True,
        help_text="Description of what this category contains",
    )
    
    icon = models.CharField(
        max_length=50,
        blank=True,
        help_text="Icon name for the category (e.g., 'settings', 'project')",
    )
    
    order = models.PositiveIntegerField(
        default=0,
        db_index=True,
        help_text="Order for displaying categories",
    )
    
    is_active = models.BooleanField(
        default=True,
        db_index=True,
        help_text="Whether this category is active",
    )
    
    class Meta:
        db_table = "settings_categories"
        ordering = ("order", "name")
        verbose_name = "Setting Category"
        verbose_name_plural = "Setting Categories"
    
    def __str__(self):
        return self.name
