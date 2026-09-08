"""
Permission classes for IP blacklist functionality.

Provides permission classes for IP blacklist-related authorization.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from rest_framework import permissions

if TYPE_CHECKING:
    from rest_framework.request import Request
    from rest_framework.views import APIView

class IsIPBlacklistOwner(permissions.BasePermission):
    """
    Allows access only to the owner of the IP blacklist entry.
    """

    message = "You do not have permission to perform this action."

    def has_object_permission(self, request: Request, view: APIView, obj: Any) -> bool:
        return obj.blocked_by == request.user


class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Allows read-only access to all users,
    but write access only to admin users.
    """

    message = "You do not have permission to perform this action."

    def has_permission(self, request: Request, view: APIView) -> bool:
        if request.method in permissions.SAFE_METHODS:
            return True
        return bool(request.user and getattr(request.user, "is_staff", False))

    def has_object_permission(self, request: Request, view: APIView, obj: Any) -> bool:
        if request.method in permissions.SAFE_METHODS:
            return True
        return bool(request.user and getattr(request.user, "is_staff", False))
