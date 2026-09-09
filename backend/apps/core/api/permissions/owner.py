"""
Owner permissions.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from .base import BasePermission

if TYPE_CHECKING:
    from rest_framework.request import Request
    from rest_framework.views import APIView

class IsOwner(BasePermission):
    """
    Object owner permission.
    """

    message = "You do not own this resource."

    def has_object_permission(self, request: Request, view: APIView, obj: Any) -> bool:
        if hasattr(obj, "owner"):
            return obj.owner == request.user

        if hasattr(obj, "created_by"):
            return obj.created_by == request.user

        return False
