"""
Read-only permissions.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from rest_framework.permissions import SAFE_METHODS

from .base import BasePermission

if TYPE_CHECKING:
    from rest_framework.request import Request
    from rest_framework.views import APIView

class ReadOnlyPermission(BasePermission):
    """
    Allow only safe methods.
    """

    message = "Read-only access."

    def has_permission(self, request: Request, view: APIView) -> bool:
        return request.method in SAFE_METHODS
