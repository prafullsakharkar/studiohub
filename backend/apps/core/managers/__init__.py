"""
Core managers.

Re-exported from apps.core.models.managers for backward compatibility.
"""

from __future__ import annotations

from apps.core.models.managers import (
    ActiveManager,
    AllObjectsManager,
    AllPublishedManager,
    BaseManager,
    DeletedObjectsManager,
    OrganizationManager,
    PublishedManager,
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
