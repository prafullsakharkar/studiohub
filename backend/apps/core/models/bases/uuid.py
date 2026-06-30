"""
UUID base model.

Provides a UUID primary key for all models.
"""

from __future__ import annotations

import uuid

from django.db import models


class UUIDModel(models.Model):
    """
    Abstract base model that provides a UUID primary key.

    Every domain model in the application should inherit from this
    class (directly or through BaseModel).
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        unique=True,
        db_index=True,
        help_text="Universally unique identifier.",
    )

    class Meta:
        abstract = True
