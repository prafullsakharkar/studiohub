"""
Metadata base model.

This is a protocol/interface for domain applications to implement.
Domain applications should define their own tags and attachments fields.

Example:
    class MyModel(MetadataModel):
        tags = models.ManyToManyField(
            "myapp.Tag",
            blank=True,
            related_name="%(app_label)s_%(class)s",
            help_text="Tags associated with this record.",
        )

        attachments = models.ManyToManyField(
            "myapp.Attachment",
            blank=True,
            related_name="%(app_label)s_%(class)s",
            help_text="Attachments associated with this record.",
        )
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from django.db import models

if TYPE_CHECKING:
    pass


class MetadataModel(models.Model):
    """
    Abstract model providing metadata storage capabilities.

    Provides:
    - JSON metadata field for extensible data

    Tags and attachments are defined by domain applications.
    """

    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional metadata stored as JSON.",
    )

    class Meta:
        abstract = True
