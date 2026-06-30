"""
Timestamp base model.
"""

from __future__ import annotations

from django.db import models


class TimeStampedModel(models.Model):
    """
    Adds automatic created/updated timestamps.
    """

    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        help_text="Object creation timestamp.",
    )

    updated_at = models.DateTimeField(
        auto_now=True,
        help_text="Last update timestamp.",
    )

    class Meta:
        abstract = True
