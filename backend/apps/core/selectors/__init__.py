"""
Core selectors.

Provides base selector classes for domain applications.
"""

from __future__ import annotations

from apps.core.selectors.attachment import AttachmentSelector
from apps.core.selectors.base import BaseSelector
from apps.core.selectors.tag import TagSelector

__all__ = [
    "AttachmentSelector",
    "BaseSelector",
    "TagSelector",
]
