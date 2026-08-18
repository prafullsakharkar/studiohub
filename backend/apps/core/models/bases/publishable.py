from __future__ import annotations

from django.db import models


class PublishableModel(models.Model):
    is_published = models.BooleanField(default=False, db_index=True)
    published_at = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        abstract = True
