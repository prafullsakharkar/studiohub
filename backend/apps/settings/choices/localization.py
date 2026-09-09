"""
Localization choices.
"""
from __future__ import annotations

from django.db import models
from django.utils.translation import gettext_lazy as _


class Language(models.TextChoices):
    """
    Language choices (ISO 639-1).
    """
    
    EN = "en", _("English")
    HI = "hi", _("Hindi")
    ES = "es", _("Spanish")
    FR = "fr", _("French")
    DE = "de", _("German")
    ZH = "zh", _("Chinese")
    JA = "ja", _("Japanese")
    KO = "ko", _("Korean")
    RU = "ru", _("Russian")
    AR = "ar", _("Arabic")


class Timezone(models.TextChoices):
    """
    Timezone choices.
    """
    
    UTC = "UTC", _("UTC")
    ASIA_KOLKATA = "Asia/Kolkata", _("India (IST)")
    ASIA_DUBAI = "Asia/Dubai", _("Dubai (GST)")
    EUROPE_LONDON = "Europe/London", _("London (GMT/BST)")
    EUROPE_PARIS = "Europe/Paris", _("Paris (CET)")
    AMERICA_NEW_YORK = "America/New_York", _("New York (EST/EDT)")
    AMERICA_LOS_ANGELES = "America/Los_Angeles", _("Los Angeles (PST/PDT)")
    OCEANIA_SYDNEY = "Australia/Sydney", _("Sydney (AEST/AEDT)")


class DateFormat(models.TextChoices):
    """
    Date format choices.
    """
    
    YYYY_MM_DD = "YYYY-MM-DD", _("YYYY-MM-DD")
    DD_MM_YYYY = "DD-MM-YYYY", _("DD-MM-YYYY")
    MM_DD_YYYY = "MM-DD-YYYY", _("MM-DD-YYYY")
    YYYY_MM_DD_SLASH = "YYYY/MM/DD", _("YYYY/MM/DD")
    DD_MM_YYYY_SLASH = "DD/MM/YYYY", _("DD/MM/YYYY")
    MM_DD_YYYY_SLASH = "MM/DD/YYYY", _("MM/DD/YYYY")


class TimeFormat(models.TextChoices):
    """
    Time format choices.
    """
    
    TIME_FORMAT_24H = "24H", _("24 Hour")
    TIME_FORMAT_12H = "12H", _("12 Hour")


class NumberFormat(models.TextChoices):
    """
    Number format choices.
    """
    
    DOT = "dot", _("1,234.56")
    COMMA = "comma", _("1.234,56")
