# services.py
"""
Application layer services.
"""

from __future__ import annotations

from apps.core.services.base import BaseService

__all__ = [
    "BaseService",
    "Service",
]


class Service(BaseService):
    """
    Alias for BaseService for application layer.
    """
