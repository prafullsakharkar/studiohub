"""
Named entity base model.
"""

from __future__ import annotations

from django.db import models

from apps.core.models.bases.entity import EntityModel
from apps.core.models.mixins.slug import SlugMixin


class NamedEntityModel(
    SlugMixin,
    EntityModel,
):
    """
    Base model for named entities.
    """

    name = models.CharField(
        max_length=255,
        db_index=True,
    )

    description = models.TextField(
        blank=True,
    )

    class Meta:
        abstract = True
