"""
Core permissions.

Provides base permission classes for domain applications.
"""

from __future__ import annotations

from apps.core.permissions.base import (
    AndPermission,
    BasePermission,
    BasePermissionChecker,
    IsAdminPermission,
    IsAuthenticatedPermission,
    IsOwnerPermission,
    NotPermission,
    OrPermission,
    ReadOnlyPermission,
    WriteOnlyPermission,
)

__all__ = [
    "AndPermission",
    "BasePermission",
    "BasePermissionChecker",
    "IsAdminPermission",
    "IsAuthenticatedPermission",
    "IsOwnerPermission",
    "NotPermission",
    "OrPermission",
    "ReadOnlyPermission",
    "WriteOnlyPermission",
]
