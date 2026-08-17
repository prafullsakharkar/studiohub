"""
Base ViewSets.
"""

from __future__ import annotations

from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from apps.core.api.mixins import (
    ContextMixin,
    ErrorMixin,
    FilteringMixin,
    PaginationMixin,
    PermissionMixin,
    QuerysetMixin,
    ResponseMixin,
)

# NOTE: HasPermission moved to identity for proper dependency direction
# Core should not import from identity (Domain→Core only)
# This import will be removed in a future refactor when BaseViewSet
# is moved to identity or the permission system is refactored


class BaseViewSet(
    ResponseMixin,
    ContextMixin,
    ErrorMixin,
    FilteringMixin,
    PaginationMixin,
    PermissionMixin,
    QuerysetMixin,
    viewsets.GenericViewSet,
):
    """
    Root ViewSet for the project.

    Every ViewSet should inherit from this class.
    """

    permission_classes = (IsAuthenticated,)

    permission_map = {}

    def get_permission_required(self):
        """
        Returns the permission required for current action.
        """

        permissions = self.permission_map.get(
            self.action,
            (),
        )

        if not permissions:
            return None

        return permissions[0]

    pass
