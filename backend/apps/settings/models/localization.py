"""
Localization model for localization settings.
"""
from __future__ import annotations

from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models.bases.entity import EntityModel
from apps.core.models.bases.timestamp import TimeStampedModel
from apps.organization.models.organization import Organization


class Localization(EntityModel, TimeStampedModel):
    """
    Localization settings for organizations.
    
    Manages language, timezone, date/time formats, and other
    localization-related settings.
    """
    
    # Language choices (ISO 639-1)
    LANGUAGE_EN = "en"
    LANGUAGE_HI = "hi"
    LANGUAGE_ES = "es"
    LANGUAGE_FR = "fr"
    LANGUAGE_DE = "de"
    LANGUAGE_ZH = "zh"
    LANGUAGE_JA = "ja"
    LANGUAGE_KO = "ko"
    LANGUAGE_RU = "ru"
    LANGUAGE_AR = "ar"
    
    LANGUAGE_CHOICES = [
        (LANGUAGE_EN, _("English")),
        (LANGUAGE_HI, _("Hindi")),
        (LANGUAGE_ES, _("Spanish")),
        (LANGUAGE_FR, _("French")),
        (LANGUAGE_DE, _("German")),
        (LANGUAGE_ZH, _("Chinese")),
        (LANGUAGE_JA, _("Japanese")),
        (LANGUAGE_KO, _("Korean")),
        (LANGUAGE_RU, _("Russian")),
        (LANGUAGE_AR, _("Arabic")),
    ]
    
    # Timezone choices
    TIMEZONE_UTC = "UTC"
    TIMEZONE_ASIA_KOLKATA = "Asia/Kolkata"
    TIMEZONE_ASIA_DUBAI = "Asia/Dubai"
    TIMEZONE_EUROPE_LONDON = "Europe/London"
    TIMEZONE_EUROPE_PARIS = "Europe/Paris"
    TIMEZONE_AMERICA_NEW_YORK = "America/New_York"
    TIMEZONE_AMERICA_LOS_ANGELES = "America/Los_Angeles"
    TIMEZONE_OCEANIA_SYDNEY = "Australia/Sydney"
    
    TIMEZONE_CHOICES = [
        (TIMEZONE_UTC, _("UTC")),
        (TIMEZONE_ASIA_KOLKATA, _("India (IST)")),
        (TIMEZONE_ASIA_DUBAI, _("Dubai (GST)")),
        (TIMEZONE_EUROPE_LONDON, _("London (GMT/BST)")),
        (TIMEZONE_EUROPE_PARIS, _("Paris (CET)")),
        (TIMEZONE_AMERICA_NEW_YORK, _("New York (EST/EDT)")),
        (TIMEZONE_AMERICA_LOS_ANGELES, _("Los Angeles (PST/PDT)")),
        (TIMEZONE_OCEANIA_SYDNEY, _("Sydney (AEST/AEDT)")),
    ]
    
    # Date format choices
    DATE_FORMAT_YYYY_MM_DD = "YYYY-MM-DD"
    DATE_FORMAT_DD_MM_YYYY = "DD-MM-YYYY"
    DATE_FORMAT_MM_DD_YYYY = "MM-DD-YYYY"
    DATE_FORMAT_YYYY_MM_DD_SLASH = "YYYY/MM/DD"
    DATE_FORMAT_DD_MM_YYYY_SLASH = "DD/MM/YYYY"
    DATE_FORMAT_MM_DD_YYYY_SLASH = "MM/DD/YYYY"
    
    DATE_FORMAT_CHOICES = [
        (DATE_FORMAT_YYYY_MM_DD, _("YYYY-MM-DD")),
        (DATE_FORMAT_DD_MM_YYYY, _("DD-MM-YYYY")),
        (DATE_FORMAT_MM_DD_YYYY, _("MM-DD-YYYY")),
        (DATE_FORMAT_YYYY_MM_DD_SLASH, _("YYYY/MM/DD")),
        (DATE_FORMAT_DD_MM_YYYY_SLASH, _("DD/MM/YYYY")),
        (DATE_FORMAT_MM_DD_YYYY_SLASH, _("MM/DD/YYYY")),
    ]
    
    # Time format choices
    TIME_FORMAT_24H = "24H"
    TIME_FORMAT_12H = "12H"
    
    TIME_FORMAT_CHOICES = [
        (TIME_FORMAT_24H, _("24 Hour")),
        (TIME_FORMAT_12H, _("12 Hour")),
    ]
    
    # Number format choices
    NUMBER_FORMAT_DOT = "dot"
    NUMBER_FORMAT_COMMA = "comma"
    
    NUMBER_FORMAT_CHOICES = [
        (NUMBER_FORMAT_DOT, _("1,234.56")),
        (NUMBER_FORMAT_COMMA, _("1.234,56")),
    ]
    
    code = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        help_text="Unique code for the localization",
    )
    
    name = models.CharField(
        max_length=255,
        db_index=True,
        help_text="Display name for the localization",
    )
    
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="localizations",
        null=True,
        blank=True,
        db_index=True,
        help_text="Organization this localization belongs to (null = default)",
    )
    
    # Language settings
    language = models.CharField(
        max_length=10,
        choices=LANGUAGE_CHOICES,
        default=LANGUAGE_EN,
        help_text="Default language",
    )
    
    # Timezone settings
    timezone = models.CharField(
        max_length=50,
        choices=TIMEZONE_CHOICES,
        default=TIMEZONE_UTC,
        help_text="Default timezone",
    )
    
    # Date format settings
    date_format = models.CharField(
        max_length=30,
        choices=DATE_FORMAT_CHOICES,
        default=DATE_FORMAT_YYYY_MM_DD,
        help_text="Default date format",
    )
    
    # Time format settings
    time_format = models.CharField(
        max_length=10,
        choices=TIME_FORMAT_CHOICES,
        default=TIME_FORMAT_24H,
        help_text="Default time format",
    )
    
    # Number format settings
    number_format = models.CharField(
        max_length=10,
        choices=NUMBER_FORMAT_CHOICES,
        default=NUMBER_FORMAT_DOT,
        help_text="Default number format",
    )
    
    # Currency settings
    currency_code = models.CharField(
        max_length=3,
        default="USD",
        help_text="Currency code (ISO 4217)",
    )
    
    currency_symbol = models.CharField(
        max_length=5,
        default="$",
        help_text="Currency symbol",
    )
    
    # Week settings
    week_start = models.PositiveSmallIntegerField(
        default=1,  # Monday
        help_text="First day of week (0=Sunday, 1=Monday)",
    )
    
    # Fiscal year settings
    fiscal_year_start = models.DateField(
        null=True,
        blank=True,
        help_text="Start date of fiscal year (MM-DD)",
    )
    
    is_active = models.BooleanField(
        default=True,
        db_index=True,
        help_text="Whether this localization is active",
    )
    
    class Meta:
        db_table = "localizations"
        ordering = ("name",)
        verbose_name = "Localization"
        verbose_name_plural = "Localizations"
    
    def __str__(self):
        return self.name
    
    def get_date_format_pattern(self) -> str:
        """Get the date format pattern for date-fns or similar libraries."""
        pattern = self.date_format
        
        # Convert to date-fns format
        pattern = pattern.replace("YYYY", "yyyy")
        pattern = pattern.replace("MM", "MM")
        pattern = pattern.replace("DD", "dd")
        
        return pattern
    
    def get_time_format_pattern(self) -> str:
        """Get the time format pattern for date-fns or similar libraries."""
        if self.time_format == self.TIME_FORMAT_24H:
            return "HH:mm"
        return "hh:mm a"
