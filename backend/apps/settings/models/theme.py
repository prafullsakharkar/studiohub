"""
Theme model for theme management.
"""
from __future__ import annotations

from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models.bases.entity import EntityModel
from apps.core.models.bases.timestamp import TimeStampedModel
from apps.organization.models.organization import Organization


class Theme(EntityModel, TimeStampedModel):
    """
    Theme configuration for organizations.
    
    Supports multiple themes with customizable colors, fonts,
    and other visual properties.
    """
    
    # Theme types
    TYPE_LIGHT = "light"
    TYPE_DARK = "dark"
    TYPE_CUSTOM = "custom"
    
    TYPE_CHOICES = [
        (TYPE_LIGHT, _("Light")),
        (TYPE_DARK, _("Dark")),
        (TYPE_CUSTOM, _("Custom")),
    ]
    
    # Font families
    FONT_SANS = "sans"
    FONT_SERIF = "serif"
    FONT_MONO = "mono"
    
    FONT_CHOICES = [
        (FONT_SANS, _("Sans Serif")),
        (FONT_SERIF, _("Serif")),
        (FONT_MONO, _("Monospace")),
    ]
    
    code = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        help_text="Unique code for the theme",
    )
    
    name = models.CharField(
        max_length=255,
        db_index=True,
        help_text="Display name for the theme",
    )
    
    description = models.TextField(
        blank=True,
        help_text="Description of this theme",
    )
    
    theme_type = models.CharField(
        max_length=20,
        choices=TYPE_CHOICES,
        default=TYPE_LIGHT,
        help_text="Type of theme",
    )
    
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="themes",
        null=True,
        blank=True,
        db_index=True,
        help_text="Organization this theme belongs to (null = default theme)",
    )
    
    # Color palette
    primary_color = models.CharField(
        max_length=7,
        default="#3B82F6",
        help_text="Primary color (hex)",
    )
    
    secondary_color = models.CharField(
        max_length=7,
        default="#10B981",
        help_text="Secondary color (hex)",
    )
    
    accent_color = models.CharField(
        max_length=7,
        default="#F59E0B",
        help_text="Accent color (hex)",
    )
    
    background_color = models.CharField(
        max_length=7,
        default="#F9FAFB",
        help_text="Background color (hex)",
    )
    
    surface_color = models.CharField(
        max_length=7,
        default="#FFFFFF",
        help_text="Surface color (hex)",
    )
    
    text_primary = models.CharField(
        max_length=7,
        default="#111827",
        help_text="Primary text color (hex)",
    )
    
    text_secondary = models.CharField(
        max_length=7,
        default="#6B7280",
        help_text="Secondary text color (hex)",
    )
    
    border_color = models.CharField(
        max_length=7,
        default="#E5E7EB",
        help_text="Border color (hex)",
    )
    
    # Typography
    font_family = models.CharField(
        max_length=20,
        choices=FONT_CHOICES,
        default=FONT_SANS,
        help_text="Font family",
    )
    
    font_size = models.PositiveSmallIntegerField(
        default=14,
        help_text="Base font size (px)",
    )
    
    border_radius = models.PositiveSmallIntegerField(
        default=8,
        help_text="Border radius (px)",
    )
    
    # Spacing
    spacing_unit = models.PositiveSmallIntegerField(
        default=8,
        help_text="Spacing unit (px)",
    )
    
    # Layout
    sidebar_collapsed = models.BooleanField(
        default=False,
        help_text="Whether sidebar is collapsed by default",
    )
    
    navbar_fixed = models.BooleanField(
        default=True,
        help_text="Whether navbar is fixed at top",
    )
    
    is_active = models.BooleanField(
        default=True,
        db_index=True,
        help_text="Whether this theme is active",
    )
    
    class Meta:
        db_table = "themes"
        ordering = ("name",)
        verbose_name = "Theme"
        verbose_name_plural = "Themes"
    
    def __str__(self):
        return self.name
    
    def get_color_palette(self) -> dict:
        """Get the color palette as a dictionary."""
        return {
            "primary": self.primary_color,
            "secondary": self.secondary_color,
            "accent": self.accent_color,
            "background": self.background_color,
            "surface": self.surface_color,
            "text_primary": self.text_primary,
            "text_secondary": self.text_secondary,
            "border": self.border_color,
        }
    
    def get_typography(self) -> dict:
        """Get the typography settings as a dictionary."""
        return {
            "font_family": self.font_family,
            "font_size": self.font_size,
            "border_radius": self.border_radius,
        }
