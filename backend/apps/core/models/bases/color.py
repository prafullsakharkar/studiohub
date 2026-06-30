from __future__ import annotations

from django.db import models


class ColorModel(models.Model):
    color = models.CharField(
        max_length=20,
        blank=True,
        help_text="Hex or named color",
    )

    class Meta:
        abstract = True
