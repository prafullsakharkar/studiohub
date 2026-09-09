"""
Tag model for categorizing entities.
"""

from __future__ import annotations

from django.db import models

from apps.core.models.bases.entity import EntityModel


class Tag(EntityModel):
    """
    Tag model for categorizing and organizing entities.

    Tags provide a flexible way to classify and search for records
    across the application.
    """

    name = models.CharField(
        max_length=100,
        db_index=True,
        unique=True,
        help_text="Tag name (lowercase, hyphenated)",
    )

    description = models.TextField(
        blank=True,
        default="",
        help_text="Description of what this tag represents",
    )

    color = models.CharField(
        max_length=20,
        blank=True,
        default="",
        help_text="Color code or name for tag display",
    )

    is_system = models.BooleanField(
        default=False,
        help_text="Whether this is a system-generated tag",
    )

    class Meta:
        db_table = "core_tag"
        ordering = ["name"]
        verbose_name = "Tag"
        verbose_name_plural = "Tags"

    def __str__(self) -> str:
        return self.name

    @property
    def slug(self) -> str:
        """Get slug from tag name."""
        from django.utils.text import slugify

        return slugify(self.name)

    @property
    def normalized_name(self) -> str:
        """Get normalized tag name."""
        return self.name.lower().strip()

    @classmethod
    def get_or_create_by_name(cls, name: str) -> tuple[Tag, bool]:
        """
        Get or create a tag by name (normalized).

        Args:
            name: The tag name

        Returns:
            Tuple of (tag, created)
        """
        normalized = name.lower().strip()
        tag, created = cls.objects.get_or_create(
            name__iexact=normalized,
            defaults={"name": normalized},
        )
        return tag, created
