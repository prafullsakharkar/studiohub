"""
Core model managers.

Managers are intentionally thin. They delegate query construction to their
associated QuerySet and must NOT contain business workflows. Business
operations belong in services.

The desired relationship is:

    Model
      ↓
    QuerySet
      ↓
    Manager

## Generic Managers (Core)

- `BaseManager` - Base manager shared across all models
- `ActiveManager` - Exposes only active objects
- `PublishedManager` - Exposes only published records
- `AllPublishedManager` - Exposes all publishable records
- `SoftDeleteManager` - Default manager excluding deleted objects
- `AllObjectsManager` - Returns all objects including deleted
- `DeletedObjectsManager` - Returns only soft-deleted objects

## Domain-Specific Managers (DEPRECATED)

- `OrganizationManager` - Organization-scoped manager. The organization
  application provides its own ``OrganizationManager``. This class is kept
  for backward compatibility only.
"""

from .active import ActiveManager
from .base import BaseManager
from .organization import OrganizationManager
from .publishable import (
    AllPublishedManager,
    PublishedManager,
)
from .soft_delete import (
    AllObjectsManager,
    DeletedObjectsManager,
    SoftDeleteManager,
)

__all__ = [
    "ActiveManager",
    "AllObjectsManager",
    "AllPublishedManager",
    "BaseManager",
    "DeletedObjectsManager",
    "OrganizationManager",
    "PublishedManager",
    "SoftDeleteManager",
]
