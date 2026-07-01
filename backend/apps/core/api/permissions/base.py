"""
Base permission classes.
"""

from __future__ import annotations

from rest_framework.permissions import BasePermission as DRFBasePermission


class BasePermission(DRFBasePermission):
    """
    Base permission class.

    Every project permission should inherit from this class.
    """

    message = "Permission denied."

    def has_permission(self, request, view):
        return True

    def has_object_permission(self, request, view, obj):
        return True
