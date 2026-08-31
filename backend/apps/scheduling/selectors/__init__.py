"""
Scheduling selectors for query operations.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from django.http import HttpRequest
    from rest_framework.viewsets import GenericViewSet


def get_calendar_event_queryset(
    *,
    request: HttpRequest,
    view: "GenericViewSet | None" = None,
) -> "QuerySet[CalendarEvent]":
    """Get filtered calendar event queryset."""
    from apps.scheduling.models import CalendarEvent
    
    qs = CalendarEvent.objects.select_related(
        "organization",
        "project",
    )
    
    org = getattr(request, "organization", None)
    if org:
        qs = qs.filter(organization=org)
    
    return qs


def get_resource_queryset(
    *,
    request: HttpRequest,
    view: "GenericViewSet | None" = None,
) -> "QuerySet[Resource]":
    """Get filtered resource queryset."""
    from apps.scheduling.models import Resource
    
    qs = Resource.objects.select_related(
        "organization",
        "department",
        "team",
        "user",
    )
    
    org = getattr(request, "organization", None)
    if org:
        qs = qs.filter(organization=org)
    
    return qs


def get_resource_schedule_queryset(
    *,
    request: HttpRequest,
    view: "GenericViewSet | None" = None,
) -> "QuerySet[ResourceSchedule]":
    """Get filtered resource schedule queryset."""
    from apps.scheduling.models import ResourceSchedule
    
    qs = ResourceSchedule.objects.select_related(
        "resource",
        "event",
        "task",
    )
    
    org = getattr(request, "organization", None)
    if org:
        qs = qs.filter(resource__organization=org)
    
    return qs


def get_resource_leave_queryset(
    *,
    request: HttpRequest,
    view: "GenericViewSet | None" = None,
) -> "QuerySet[ResourceLeave]":
    """Get filtered resource leave queryset."""
    from apps.scheduling.models import ResourceLeave
    
    qs = ResourceLeave.objects.select_related(
        "resource",
        "approved_by",
    )
    
    org = getattr(request, "organization", None)
    if org:
        qs = qs.filter(resource__organization=org)
    
    return qs


def get_holiday_queryset(
    *,
    request: HttpRequest,
    view: "GenericViewSet | None" = None,
) -> "QuerySet[Holiday]":
    """Get filtered holiday queryset."""
    from apps.scheduling.models import Holiday
    
    qs = Holiday.objects.select_related("organization")
    
    org = getattr(request, "organization", None)
    if org:
        qs = qs.filter(organization=org)
    
    return qs
