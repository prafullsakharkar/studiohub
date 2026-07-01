"""
Owner permissions.
"""

from __future__ import annotations

from .base import BasePermission


class IsOwner(BasePermission):
    """
    Object owner permission.
    """

    message = "You do not own this resource."

    def has_object_permission(self, request, view, obj):
        if hasattr(obj, "owner"):
            return obj.owner == request.user

        if hasattr(obj, "created_by"):
            return obj.created_by == request.user

        return False
