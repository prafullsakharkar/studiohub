"""
Scheduling selectors for query operations.
"""
from __future__ import annotations

from typing import Any

from django.db.models import QuerySet

from apps.core.selectors.base import BaseSelector
from apps.scheduling.models import (
    CalendarEvent,
    Holiday,
    Resource,
    ResourceLeave,
    ResourceSchedule,
)


class CalendarEventSelector(BaseSelector):
    """Read-side data access for calendar events (platform-global)."""

    model = CalendarEvent

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[Any, Any]:
        return cls.model.objects.select_related(
            "project",
        )


class ResourceSelector(BaseSelector):
    """Read-side data access for scheduling resources (platform-global)."""

    model = Resource

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[Any, Any]:
        return cls.model.objects.select_related(
            "department",
            "team",
            "user",
        )


class ResourceScheduleSelector(BaseSelector):
    """Read-side data access for resource schedules (platform-global)."""

    model = ResourceSchedule

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[Any, Any]:
        return cls.model.objects.select_related(
            "resource",
            "event",
            "task",
        )


class ResourceLeaveSelector(BaseSelector):
    """Read-side data access for resource leaves (platform-global)."""

    model = ResourceLeave

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[Any, Any]:
        return cls.model.objects.select_related(
            "resource",
            "approved_by",
        )


class HolidaySelector(BaseSelector):
    """Read-side data access for holidays (platform-global)."""

    model = Holiday

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[Any, Any]:
        return cls.model.objects.all()
