"""
Publishable managers.

Re-exported from apps.core.models.managers for backward compatibility.
"""

from __future__ import annotations

from apps.core.models.managers.publishable import (
    AllPublishedManager,
    PublishedManager,
)

__all__ = [
    "PublishedManager",
    "AllPublishedManager",
]
