"""
Theme choices.
"""
from __future__ import annotations

from django.db import models
from django.utils.translation import gettext_lazy as _


class ThemeType(models.TextChoices):
    """
    Theme types.
    """
    
    LIGHT = "light", _("Light")
    DARK = "dark", _("Dark")
    CUSTOM = "custom", _("Custom")


class FontFamily(models.TextChoices):
    """
    Font families.
    """
    
    SANS = "sans", _("Sans Serif")
    SERIF = "serif", _("Serif")
    MONO = "mono", _("Monospace")
