"""
Permission exports.

Core provides only generic, domain-agnostic permissions.
Domain-specific permissions (organization, project, reviewer) live in
their respective domain apps.
"""

from .base import BasePermission
from .mixins import PermissionMapPermission
from .owner import IsOwner
from .readonly import ReadOnlyPermission
from .resolver import PermissionResolver
from .staff import IsStaff, IsSuperUser

__all__ = [
    "BasePermission",
    "IsOwner",
    "IsStaff",
    "IsSuperUser",
    "PermissionMapPermission",
    "PermissionResolver",
    "ReadOnlyPermission",
]
