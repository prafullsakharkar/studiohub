"""
Authentication permission classes for identity app.

Provides permission classes for authentication-related authorization.
"""

from __future__ import annotations

from rest_framework import permissions


class IsAuthenticated(permissions.IsAuthenticated):
    """
    Allows access only to authenticated users.
    """

    message = "Authentication credentials were not provided."


class IsAdminUser(permissions.IsAdminUser):
    """
    Allows access only to admin users.
    """

    message = "You do not have permission to perform this action."


class IsSuperUser(permissions.BasePermission):
    """
    Allows access only to super users.
    """

    message = "You do not have permission to perform this action."

    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated and request.user.is_superuser
        )
