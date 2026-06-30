"""
Audit base model.

Provides created_by, updated_by and deleted_by fields.
"""

from __future__ import annotations

from django.conf import settings
from django.db import models


class AuditModel(models.Model):
    """
    Abstract model providing audit information.

    Tracks which user created, updated and deleted an object.
    """

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="%(app_label)s_%(class)s_created",
        null=True,
        blank=True,
        editable=False,
        help_text="User who created this object.",
    )

    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="%(app_label)s_%(class)s_updated",
        null=True,
        blank=True,
        editable=False,
        help_text="User who last updated this object.",
    )

    deleted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="%(app_label)s_%(class)s_deleted",
        null=True,
        blank=True,
        editable=False,
        help_text="User who deleted this object.",
    )

    class Meta:
        abstract = True
