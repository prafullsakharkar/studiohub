"""
Staff permissions.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from .base import BasePermission

if TYPE_CHECKING:
    from rest_framework.request import Request
    from rest_framework.views import APIView

class IsStaff(BasePermission):
    """
    Allow staff users only.
    """

    message = "Staff access required."

    def has_permission(self, request: Request, view: APIView) -> bool:
        return request.user.is_authenticated and getattr(request.user, "is_staff", False)


class IsSuperUser(BasePermission):
    """
    Allow superusers only.
    """

    message = "Superuser access required."

    def has_permission(self, request: Request, view: APIView) -> bool:
        return request.user.is_authenticated and getattr(request.user, "is_superuser", False)
