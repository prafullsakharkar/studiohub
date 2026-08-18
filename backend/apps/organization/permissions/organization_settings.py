"""Organization settings permissions."""

from __future__ import annotations

from django.http import HttpRequest
from rest_framework.permissions import BasePermission


class OrganizationSettingsPermissions(BasePermission):
    """Permission class for OrganizationSettings operations."""

    def has_permission(self, request: HttpRequest, view) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_staff:
            return True
        return True

    def has_object_permission(self, request: HttpRequest, view, obj) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_staff:
            return True
        return True
