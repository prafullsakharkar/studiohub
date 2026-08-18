"""
Permission classes for IP blacklist functionality.

Provides permission classes for IP blacklist-related authorization.
"""

from __future__ import annotations

from rest_framework import permissions


class IsIPBlacklistOwner(permissions.BasePermission):
    """
    Allows access only to the owner of the IP blacklist entry.
    """

    message = "You do not have permission to perform this action."

    def has_object_permission(self, request, view, obj):
        return obj.blocked_by == request.user


class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Allows read-only access to all users,
    but write access only to admin users.
    """

    message = "You do not have permission to perform this action."

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_staff)

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_staff)
