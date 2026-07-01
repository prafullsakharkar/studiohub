"""
Reviewer permissions.
"""

from __future__ import annotations

from .base import BasePermission


class IsReviewer(BasePermission):
    """
    Reviewer permission.
    """

    message = "Reviewer access required."

    def has_permission(self, request, view):
        return request.user.is_authenticated and getattr(request.user, "is_reviewer", False)
