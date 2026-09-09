"""
Notes base model.
"""
from __future__ import annotations

from django.db import models


class NotesModel(models.Model):
    """
    Abstract model providing notes field for additional information.
    
    Provides:
    - Notes field for storing additional text information
    """

    notes = models.TextField(
        blank=True,
        default="",
        help_text="Additional notes about this record.",
    )

    class Meta:
        abstract = True
