from __future__ import annotations

from django.db import models


class MetadataModel(models.Model):
    metadata = models.JSONField(
        default=dict, blank=True, help_text="Additional metadata stored as JSON."
    )

    class Meta:
        abstract = True
