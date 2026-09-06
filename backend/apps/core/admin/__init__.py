"""
Core admin module.
"""

from .attachment import AttachmentAdmin
from .base import StudioHubModelAdmin
from .tag import TagAdmin

__all__ = [
    "StudioHubModelAdmin",
    "AttachmentAdmin",
    "TagAdmin",
]
