from __future__ import annotations

from django.db import models
from django.utils.text import slugify


class NameSlugModel(models.Model):
    """
    Common name/slug fields.
    """

    name = models.CharField(
        max_length=255,
        db_index=True,
    )

    slug = models.SlugField(
        max_length=255,
        unique=True,
        blank=True,
    )

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        if self.name and not self.slug:
            self.slug = slugify(self.name)

        super().save(*args, **kwargs)
