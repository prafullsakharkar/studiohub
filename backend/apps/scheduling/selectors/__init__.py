"""
Scheduling selectors for query operations.
"""
from __future__ import annotations

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
    """
    Read-side data access for calendar events.

    Organization scoping is applied by the viewset through
    ``scope_by_request`` (fail closed).
    """

    model = CalendarEvent

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet:
        return cls.model.objects.select_related(
            "organization",
            "project",
        )


class ResourceSelector(BaseSelector):
    """Read-side data access for scheduling resources."""

    model = Resource

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet:
        return cls.model.objects.select_related(
            "organization",
            "department",
            "team",
            "user",
        )


class ResourceScheduleSelector(BaseSelector):
    """
    Read-side data access for resource schedules.

    Schedules have no direct organization foreign key; they are scoped
    through the related resource.
    """

    model = ResourceSchedule
    scope_field = "resource__organization"

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet:
        return cls.model.objects.select_related(
            "resource",
            "event",
            "task",
        )


class ResourceLeaveSelector(BaseSelector):
    """
    Read-side data access for resource leaves.

    Leaves have no direct organization foreign key; they are scoped
    through the related resource.
    """

    model = ResourceLeave
    scope_field = "resource__organization"

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet:
        return cls.model.objects.select_related(
            "resource",
            "approved_by",
        )


class HolidaySelector(BaseSelector):
    """Read-side data access for holidays."""

    model = Holiday

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet:
        return cls.model.objects.select_related("organization")
