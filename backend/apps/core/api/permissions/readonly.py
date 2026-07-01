"""
Read-only permissions.
"""

from __future__ import annotations

from rest_framework.permissions import SAFE_METHODS

from .base import BasePermission


class ReadOnlyPermission(BasePermission):
    """
    Allow only safe methods.
    """

    message = "Read-only access."

    def has_permission(self, request, view):
        return request.method in SAFE_METHODS
