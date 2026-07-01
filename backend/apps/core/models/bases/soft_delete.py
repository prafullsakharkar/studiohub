"""
Soft delete base model.
"""

from __future__ import annotations

from django.db import models

from apps.core.choices import RecordStatus
from apps.core.models.managers import (
    AllObjectsManager,
    SoftDeleteManager,
)


class SoftDeleteModel(models.Model):
    """
    Abstract model implementing soft delete support.
    """

    is_deleted = models.BooleanField(
        default=False,
        db_index=True,
    )

    status = models.CharField(
        max_length=20,
        choices=RecordStatus.choices,
        default=RecordStatus.ACTIVE,
        db_index=True,
    )

    deleted_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    objects = SoftDeleteManager()

    all_objects = AllObjectsManager()

    class Meta:
        abstract = True
