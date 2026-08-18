"""
Model managers.
"""

from __future__ import annotations

from apps.core.models.managers.active import ActiveManager
from apps.core.models.managers.base import BaseManager
from apps.core.models.managers.organization import OrganizationManager
from apps.core.models.managers.publishable import (
    AllPublishedManager,
    PublishedManager,
)
from apps.core.models.managers.soft_delete import (
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
