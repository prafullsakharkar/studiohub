from __future__ import annotations

from django.db import models


class OrderableModel(models.Model):
    """
    Used for manual ordering.
    """

    order = models.PositiveIntegerField(
        default=0,
        db_index=True,
    )

    class Meta:
        abstract = True
        ordering = ("order",)
