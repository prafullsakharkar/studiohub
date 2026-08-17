"""
Core model mixins.

This package provides reusable mixins that delegate to services for their
behavior. Mixins are a good way to add small, focused capabilities to models.

## Available Mixins

- `SlugMixin` - Slug generation via SlugService
- `SoftDeleteMixin` - Soft delete via SoftDeleteService
- `AuditMixin` - Audit marking via AuditService
- `ColorMixin` - Color utilities via ColorService
- `MetadataMixin` - Metadata operations via MetadataService
- `OrderingMixin` - Ordering operations via OrderingService
- `OwnershipMixin` - Ownership checks (business logic)
- `PublishableMixin` - Publish/unpublish via PublishableService
- `SearchMixin` - Search normalization via SearchService

## Usage

```python
from django.db import models
from apps.core.models.mixins import SlugMixin, SoftDeleteMixin


class MyModel(SlugMixin, SoftDeleteMixin, models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
```

## Note on Duplication

Some capabilities have both a base model and a mixin (e.g., `SoftDeleteModel`
and `SoftDeleteMixin`). Use the base model when you need the database fields,
and use the mixin when you need the helper methods without extra fields.
"""

from .audit import AuditMixin
from .base import BaseMixin
from .color import ColorMixin
from .metadata import MetadataMixin
from .ordering import OrderingMixin
from .ownership import OwnershipMixin
from .publishable import PublishableMixin
from .search import SearchMixin
from .slug import SlugMixin
from .soft_delete import SoftDeleteMixin

__all__ = [
    "AuditMixin",
    "BaseMixin",
    "ColorMixin",
    "MetadataMixin",
    "OrderingMixin",
    "OwnershipMixin",
    "PublishableMixin",
    "SearchMixin",
    "SlugMixin",
    "SoftDeleteMixin",
]
