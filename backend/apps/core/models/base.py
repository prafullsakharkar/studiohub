"""
Core base model.

This is the recommended base class for domain models. It combines the most
commonly used capabilities:

- UUIDModel - UUID primary key
- TimeStampedModel - created_at, updated_at
- SoftDeleteModel - soft delete support
- AuditModel - created_by, updated_by, deleted_by
- OrderableModel - ordering support
- PublishableModel - publish/unpublish support
- MetadataModel - JSON metadata storage
- ColorModel - color field

## Usage

```python
from django.db import models
from apps.core.models import BaseModel


class MyModel(BaseModel):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    class Meta:
        db_table = "my_app_my_model"
```

## Customizing Base Model

If you need a different combination of capabilities, import the individual
base models directly:

```python
from django.db import models
from apps.core.models.bases import (
    UUIDModel,
    TimeStampedModel,
    SoftDeleteModel,
    AuditModel,
)


class MyModel(UUIDModel, TimeStampedModel, SoftDeleteModel, AuditModel):
    name = models.CharField(max_length=255)

    class Meta:
        db_table = "my_app_my_model"
```
"""

from .bases.audit import AuditModel
from .bases.color import ColorModel
from .bases.metadata import MetadataModel
from .bases.orderable import OrderableModel
from .bases.publishable import PublishableModel
from .bases.soft_delete import SoftDeleteModel
from .bases.timestamp import TimeStampedModel
from .bases.uuid import UUIDModel


class BaseModel(
    UUIDModel,
    TimeStampedModel,
    SoftDeleteModel,
    AuditModel,
    OrderableModel,
    PublishableModel,
    MetadataModel,
    ColorModel,
):
    """
    Base model inherited by all domain models.

    This combines the most commonly used capabilities. For a different
    combination, import individual base models directly.
    """

    class Meta:
        abstract = True
