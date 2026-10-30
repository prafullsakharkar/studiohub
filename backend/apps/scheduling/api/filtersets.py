"""
Filters of the scheduling lists (CR-25). Every list is a bare array and, until now, ignored all of these.

Rules shared by all of them: a value is matched in any case where it is a word; a related record is filtered by
id under both spellings the frontend uses (``resource`` / ``resource_id``, ``project`` / ``project_id``); a value
that is not an id is a 400 (django-filter), a word nobody has answers an empty list. ``start`` / ``end`` narrow to
what overlaps the window: date-times with a time zone for bookings and events (a naive one is a 400), plain days
for leave. ``search`` and ``ordering`` are unchanged.
"""

from __future__ import annotations

from datetime import timedelta
from uuid import UUID

import django_filters
from django.db.models import Q
from django.utils import timezone

from apps.core.filters import BaseFilterSet
from apps.scheduling.models import (
    CalendarEvent,
    Milestone,
    Resource,
    ResourceLeave,
    ResourceSchedule,
)


def _word(value: str | None) -> str:
    return (value or "").strip()


class ResourceFilterSet(BaseFilterSet):
    resource_type = django_filters.CharFilter(field_name="resource_type", lookup_expr="iexact")
    #: the status the list SHOWS (derived: "On Leave" while an approved leave covers today), any case
    status = django_filters.CharFilter(method="filter_status")
    department = django_filters.UUIDFilter(field_name="department_id")
    department_id = django_filters.UUIDFilter(field_name="department_id")
    team = django_filters.UUIDFilter(field_name="team_id")
    team_id = django_filters.UUIDFilter(field_name="team_id")
    calendar = django_filters.UUIDFilter(field_name="calendar_id")
    calendar_id = django_filters.UUIDFilter(field_name="calendar_id")

    class Meta:
        model = Resource
        fields: list[str] = []

    def filter_status(self, queryset, name, value):
        from apps.scheduling.selectors.resource_status import (
            ACTIVE,
            ON_LEAVE,
            UNAVAILABLE,
            ResourceStatusSelector,
            current_leaves_prefetch,
        )

        word = _word(value).lower()
        if not word:
            return queryset
        wanted = {
            ACTIVE.lower(): ACTIVE,
            ON_LEAVE.lower(): ON_LEAVE,
            UNAVAILABLE.lower(): UNAVAILABLE,
        }.get(word)
        if wanted is None:
            return queryset.none()
        # Only resources with approved leave near today can be On Leave; derive exactly for those.
        near = (
            Resource.objects.filter(
                leaves__status=ResourceLeave.STATUS_APPROVED,
                leaves__start_date__lte=timezone.now().date() + timedelta(days=1),
                leaves__end_date__gte=timezone.now().date() - timedelta(days=1),
            )
            .select_related("calendar")
            .prefetch_related(current_leaves_prefetch())
            .distinct()
        )
        statuses = ResourceStatusSelector()
        on_leave = [r.pk for r in near if statuses.status_of(r) == ON_LEAVE]
        if wanted == ON_LEAVE:
            return queryset.filter(pk__in=on_leave)
        queryset = queryset.exclude(pk__in=on_leave)
        if wanted == UNAVAILABLE:
            return queryset.filter(status=UNAVAILABLE)
        return queryset.exclude(status=UNAVAILABLE)


class BookingFilterSet(BaseFilterSet):
    resource = django_filters.UUIDFilter(field_name="resource_id")
    resource_id = django_filters.UUIDFilter(field_name="resource_id")
    status = django_filters.CharFilter(field_name="status", lookup_expr="iexact")
    event = django_filters.UUIDFilter(field_name="event_id")
    task = django_filters.UUIDFilter(field_name="task_id")

    class Meta:
        model = ResourceSchedule
        fields: list[str] = []


class LeaveFilterSet(BaseFilterSet):
    status = django_filters.CharFilter(field_name="status", lookup_expr="iexact")
    leave_type = django_filters.CharFilter(field_name="leave_type", lookup_expr="iexact")
    resource = django_filters.UUIDFilter(field_name="resource_id")
    resource_id = django_filters.UUIDFilter(field_name="resource_id")
    start = django_filters.DateFilter(method="filter_start")
    end = django_filters.DateFilter(method="filter_end")

    class Meta:
        model = ResourceLeave
        fields: list[str] = []

    def filter_start(self, queryset, name, value):
        return queryset.filter(end_date__gte=value)  # still on or after the window opens

    def filter_end(self, queryset, name, value):
        return queryset.filter(start_date__lte=value)  # begun on or before the window closes


class EventFilterSet(BaseFilterSet):
    project = django_filters.UUIDFilter(field_name="project_id")
    project_id = django_filters.UUIDFilter(field_name="project_id")
    event_type = django_filters.CharFilter(field_name="event_type", lookup_expr="iexact")
    status = django_filters.CharFilter(field_name="status", lookup_expr="iexact")
    visibility = django_filters.CharFilter(field_name="visibility", lookup_expr="iexact")
    start = django_filters.CharFilter(method="filter_start")
    end = django_filters.CharFilter(method="filter_end")

    class Meta:
        model = CalendarEvent
        fields: list[str] = []

    def filter_start(self, queryset, name, value):
        from apps.scheduling.selectors import ResourceScheduleSelector

        window = ResourceScheduleSelector._window(value, name)
        return queryset if window is None else queryset.filter(end_time__gt=window)

    def filter_end(self, queryset, name, value):
        from apps.scheduling.selectors import ResourceScheduleSelector

        window = ResourceScheduleSelector._window(value, name)
        return queryset if window is None else queryset.filter(start_time__lt=window)


class MilestoneFilterSet(BaseFilterSet):
    status = django_filters.CharFilter(field_name="status", lookup_expr="iexact")
    kind = django_filters.CharFilter(field_name="kind", lookup_expr="iexact")
    project = django_filters.CharFilter(method="filter_project")
    project_id = django_filters.CharFilter(method="filter_project")

    class Meta:
        model = Milestone
        fields: list[str] = []

    def filter_project(self, queryset, name, value):
        """A project's id or its code (the contract says both; only the id used to work)."""
        word = _word(value)
        if not word:
            return queryset
        try:
            return queryset.filter(project_id=UUID(word))
        except ValueError:
            return queryset.filter(Q(project__code__iexact=word))
