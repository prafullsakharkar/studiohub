"""
Search service.
"""

from __future__ import annotations

from .base import BaseService


class SearchService(BaseService):
    """
    Service for search operations.
    """

    @classmethod
    def normalize(cls, value: str):
        return value.strip().lower()
