"""
Record status choices.
"""

from __future__ import annotations

from .base import BaseChoices


class RecordStatus(BaseChoices):
    """
    Lifecycle state of a database record.
    """

    ACTIVE = "active", "Active"
    INACTIVE = "inactive", "Inactive"
    ARCHIVED = "archived", "Archived"
    DELETED = "deleted", "Deleted"
