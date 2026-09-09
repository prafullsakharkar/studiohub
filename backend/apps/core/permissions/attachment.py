"""
Attachment permissions.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from django.contrib.auth import get_user_model
from rest_framework.permissions import BasePermission

if TYPE_CHECKING:
    from django.http import HttpRequest


User = get_user_model()


class AttachmentPermissions(BasePermission):
    """
    Permissions for Attachment operations.
    """

    def has_permission(self, request: HttpRequest, view) -> bool:
        """
        Check if the user has permission for the view.
        """
        if not request.user or not request.user.is_authenticated:
            return False

        # Staff users have full access
        if getattr(request.user, "is_staff", False):
            return True

        # Organization members can view and manage their own attachments
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

        # Staff users have full access
        if getattr(request.user, "is_staff", False):
            return True

        # Organization members can manage their own attachments
        if hasattr(obj, "organization"):
            return obj.organization == getattr(request.user, "organization", None)

        return False


__all__ = ["AttachmentPermissions", "AttachmentPermission"]

# Alias for backward compatibility
AttachmentPermission = AttachmentPermissions
