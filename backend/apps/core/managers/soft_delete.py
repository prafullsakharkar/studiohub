"""
Soft delete managers.

Re-exported from apps.core.models.managers for backward compatibility.
"""

from __future__ import annotations

from apps.core.models.managers.soft_delete import (
    AllObjectsManager,
    DeletedObjectsManager,
    SoftDeleteManager,
)

__all__ = [
    "SoftDeleteManager",
    "AllObjectsManager",
    "DeletedObjectsManager",
]
