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
from apps.identity.permissions import (
    HasPermission,
)


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

    permission_classes = (
        IsAuthenticated,
        HasPermission,
    )

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
