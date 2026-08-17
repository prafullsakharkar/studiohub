"""
Core model querysets.

QuerySets are responsible for query construction only. They must NOT:

- execute business workflows
- send notifications
- publish domain events
- call external systems
- perform unrelated mutations

## Generic QuerySets (Core)

- `BaseQuerySet` - Base queryset with common helpers (active, inactive, ids,
  ordered, latest_first, oldest_first)
- `PublishableQuerySet` - Publishable model queries (published, unpublished,
  scheduled)
- `SoftDeleteQuerySet` - Soft delete queries (alive, deleted, with_deleted)

## Domain-Specific QuerySets (DEPRECATED)

- `OrganizationQuerySet` - Organization-scoped queries. The organization
  application provides its own ``OrganizationQuerySet``. This class is kept
  for backward compatibility only.
"""

from .base import BaseQuerySet
from .organization import OrganizationQuerySet
from .publishable import PublishableQuerySet
from .soft_delete import SoftDeleteQuerySet

__all__ = [
    "BaseQuerySet",
    "OrganizationQuerySet",
    "PublishableQuerySet",
    "SoftDeleteQuerySet",
]
