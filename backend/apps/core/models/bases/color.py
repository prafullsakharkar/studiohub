from __future__ import annotations

from django.db import models

from apps.core.validators.color import HexColorValidator


class ColorModel(models.Model):
    color = models.CharField(
        max_length=32,
        blank=True,
        help_text="Hex color or CSS color value.",
        validators=[HexColorValidator()],
    )

    class Meta:
        abstract = True
