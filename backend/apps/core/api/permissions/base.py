"""
Base permission classes.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from rest_framework.permissions import BasePermission as DRFBasePermission

if TYPE_CHECKING:
    from rest_framework.request import Request
    from rest_framework.views import APIView

class BasePermission(DRFBasePermission):
    """
    Base permission class.

    Every project permission should inherit from this class.
    """

    message = "Permission denied."

    def has_permission(self, request: Request, view: APIView) -> bool:
        return True

    def has_object_permission(self, request: Request, view: APIView, obj: Any) -> bool:
        return True
