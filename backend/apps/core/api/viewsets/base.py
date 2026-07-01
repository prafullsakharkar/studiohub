"""
Base ViewSets.
"""

from __future__ import annotations

from rest_framework import viewsets

from apps.core.api.mixins import (
    ContextMixin,
    ErrorMixin,
    FilteringMixin,
    PaginationMixin,
    PermissionMixin,
    QuerysetMixin,
    ResponseMixin,
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

    pass
