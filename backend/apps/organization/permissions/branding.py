"""
Organization branding permissions.
"""

from __future__ import annotations

from django.http import HttpRequest
from rest_framework.permissions import BasePermission


class BrandingPermissions(BasePermission):
    """Permission class for branding operations."""

    def has_permission(self, request: HttpRequest, view) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_staff:
            return True
        return True
