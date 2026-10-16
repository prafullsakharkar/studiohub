"""
Platform selectors.
"""
from __future__ import annotations

from typing import Any

from django.db.models import QuerySet

from apps.platform.models import ProductionReport, StudioNotification


class StudioNotificationSelector:
    """Selector for platform-global studio notifications."""

    model = StudioNotification

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ) -> QuerySet[Any, Any]:
        return cls.model.objects.all()

    @classmethod
    def scope_by_request(
        cls,
        queryset: QuerySet[Any, Any],
        *,
        request=None,
        view=None,
    ) -> QuerySet[Any, Any]:
        # Platform-global: no tenant partition. Authenticated callers see
        # every row; anonymous callers see nothing.
        user = getattr(request, "user", None) if request else None
        if user is None or not getattr(user, "is_authenticated", False):
            return queryset.none()
        return queryset


class ProductionReportSelector:
    """Selector for platform-global production reports."""

    model = ProductionReport

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ) -> QuerySet[Any, Any]:
        return cls.model.objects.all()

    @classmethod
    def scope_by_request(
        cls,
        queryset: QuerySet[Any, Any],
        *,
        request=None,
        view=None,
    ) -> QuerySet[Any, Any]:
        # Platform-global: no tenant partition. Authenticated callers see
        # every row; anonymous callers see nothing.
        user = getattr(request, "user", None) if request else None
        if user is None or not getattr(user, "is_authenticated", False):
            return queryset.none()
        return queryset
