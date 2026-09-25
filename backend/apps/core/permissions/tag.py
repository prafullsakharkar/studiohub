"""
Tag permissions.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from django.contrib.auth import get_user_model
from rest_framework.permissions import BasePermission

if TYPE_CHECKING:
    from django.http import HttpRequest


User = get_user_model()


class TagPermissions(BasePermission):
    """
    Permissions for Tag operations.
    """

    def has_permission(self, request: HttpRequest, view) -> bool:
        """
        Check if the user has permission for the view.
        """
        if not request.user or not request.user.is_authenticated:
            return False

        # Superusers have full (break-glass) access — ADR-0033 D4.
        if getattr(request.user, "is_superuser", False):
            return True

        # Organization members can view and manage their own tags
        if getattr(view, "action", None) in ["list", "retrieve"]:
            return True

        if getattr(view, "action", None) in ["create"]:
            return True

        return getattr(view, "action", None) in ["update", "partial_update", "destroy"]

    def has_object_permission(self, request: HttpRequest, view, obj) -> bool:
        """
        Check if the user has permission for the object.
        """
        if not request.user or not request.user.is_authenticated:
            return False

        # Superusers have full (break-glass) access — ADR-0033 D4.
        if getattr(request.user, "is_superuser", False):
            return True

        # Organization members can manage their own tags
        if hasattr(obj, "organization"):
            return obj.organization == getattr(request.user, "organization", None)

        return False


__all__ = ["TagPermissions", "TagPermission"]

# Alias for backward compatibility
TagPermission = TagPermissions
