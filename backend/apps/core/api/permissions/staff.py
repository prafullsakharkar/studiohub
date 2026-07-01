"""
Staff permissions.
"""

from __future__ import annotations

from .base import BasePermission


class IsStaff(BasePermission):
    """
    Allow staff users only.
    """

    message = "Staff access required."

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_staff


class IsSuperUser(BasePermission):
    """
    Allow superusers only.
    """

    message = "Superuser access required."

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_superuser
