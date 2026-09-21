"""
Platform selectors.
"""
from __future__ import annotations

from typing import Any

from django.db.models import QuerySet

from apps.platform.models import ProductionReport, StudioNotification


class StudioNotificationSelector:
    """Selector for organization-scoped studio notifications."""

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
        organization = getattr(request, "organization", None) if request else None
        if organization is None:
            return queryset.none()
        return queryset.filter(organization=organization)


class ProductionReportSelector:
    """Selector for organization-scoped production reports."""

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
        organization = getattr(request, "organization", None) if request else None
        if organization is None:
            return queryset.none()
        return queryset.filter(organization=organization)
