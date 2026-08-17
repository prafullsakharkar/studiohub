"""
Core models package.

This package provides reusable model components for the StudioHub application.
The design follows the principle of composition over inheritance - use only
the capabilities you need.

## Quick Start

```python
from django.db import models
from apps.core.models import UUIDModel, TimeStampedModel, SoftDeleteModel


class MyModel(UUIDModel, TimeStampedModel, SoftDeleteModel):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    class Meta:
        db_table = "my_app_my_model"
```

## Available Components

### Base Models (from `apps.core.models.bases`)

Generic capabilities:
- `UUIDModel` - UUID primary key
- `TimeStampedModel` - created_at, updated_at
- `SoftDeleteModel` - soft delete support
- `AuditModel` - created_by, updated_by, deleted_by
- `OrderableModel` - ordering support
- `PublishableModel` - publish/unpublish support
- `MetadataModel` - JSON metadata storage
- `ColorModel` - color field
- `LifecycleModel` - lifecycle status

Entity models:
- `EntityModel` - UUID + Timestamp + Audit + Metadata + SoftDelete
- `NamedEntityModel` - EntityModel + name + description + slug

### Mixins (from `apps.core.models.mixins`)

Helper mixins that delegate to services:
- `SlugMixin` - Slug generation
- `SoftDeleteMixin` - Soft delete methods
- `AuditMixin` - Audit marking methods
- `ColorMixin` - Color utilities
- `MetadataMixin` - Metadata operations
- `OrderingMixin` - Ordering operations
- `OwnershipMixin` - Ownership checks
- `PublishableMixin` - Publish/unpublish methods
- `SearchMixin` - Search normalization

### QuerySets (from `apps.core.models.querysets`)

QuerySets are responsible for query construction only. They must NOT execute
business workflows, send notifications, publish domain events, or perform
unrelated mutations.

- `BaseQuerySet` - Base queryset class (active, inactive, ids, ordered,
  latest_first, oldest_first)
- `PublishableQuerySet` - Publishable model queries (published, unpublished,
  scheduled)
- `SoftDeleteQuerySet` - Soft delete queries (alive, deleted, with_deleted)

### Managers (from `apps.core.models.managers`)

Managers are thin and delegate query construction to their QuerySet. Business
operations belong in services.

- `BaseManager` - Base manager class
- `ActiveManager` - Active object manager
- `PublishedManager` - Published object manager
- `SoftDeleteManager` - Soft delete manager
"""

from .base import *
from .bases import *
from .mixins import *
from .querysets import *
