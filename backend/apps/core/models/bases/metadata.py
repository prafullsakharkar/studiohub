from __future__ import annotations

from django.db import models


class MetadataModel(models.Model):
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        abstract = True
