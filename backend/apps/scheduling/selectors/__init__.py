"""
Scheduling selectors for query operations.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from django.db.models import QuerySet

from apps.core.selectors.base import BaseSelector
from apps.scheduling.models import (
    CalendarEvent,
    Holiday,
    Milestone,
    Resource,
    ResourceLeave,
    ResourceSchedule,
    WorkCalendar,
)
from apps.scheduling.selectors.scope import ViewerScope


class CalendarEventSelector(BaseSelector):
    """Read-side data access for calendar events (platform-global)."""

    model = CalendarEvent

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[Any, Any]:
        """Events the caller may see (D-21). Without a request (internal callers): all."""
        queryset = cls.model.objects.select_related("project")
        if request is None:
            return queryset
        return ViewerScope.of(request).filter_events(queryset)


class ResourceSelector(BaseSelector):
    """Read-side data access for scheduling resources (platform-global)."""

    model = Resource

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[Any, Any]:
        from apps.scheduling.selectors.resource_status import current_leaves_prefetch

        return cls.model.objects.select_related(
            "department",
            "team",
            "user",
            "calendar",
        ).prefetch_related(current_leaves_prefetch())

    @classmethod
    def can_see_rates(cls, user: Any, resource: Any, *, holder: bool | None = None) -> bool:
        """
        Whether ``user`` may read the pay rate and e-mail of ``resource`` (D-21): a holder of
        ``schedule.view_rates`` (or a superuser), or the person the resource is.
        """
        if user is None or not getattr(user, "is_authenticated", False):
            return False
        if resource.user_id is not None and resource.user_id == user.pk:
            return True
        return cls.holds_rates_code(user) if holder is None else holder

    @classmethod
    def holds_rates_code(cls, user: Any) -> bool:
        from apps.identity.services.permission_cache import PermissionCacheService
        from apps.scheduling.constants.permissions import SchedulingPermissions

        if user is None or not getattr(user, "is_authenticated", False):
            return False
        if getattr(user, "is_superuser", False):
            return True
        return bool(
            PermissionCacheService.has_permission(
                user=user, permission=SchedulingPermissions.VIEW_RATES
            )
        )


class ResourceScheduleSelector(BaseSelector):
    """Read-side data access for resource schedules (platform-global)."""

    model = ResourceSchedule

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[Any, Any]:
        queryset = cls.model.objects.select_related(
            "resource",
            "event",
            "task",
        )
        params = getattr(request, "query_params", None)
        if params is not None:
            start, end = cls._window(params.get("start")), cls._window(params.get("end"))
            if start is not None:
                queryset = queryset.filter(
                    end_time__gt=start
                )  # still running after the window opens
            if end is not None:
                queryset = queryset.filter(start_time__lt=end)  # begun before the window closes
        return queryset

    @staticmethod
    def _window(raw: Any):
        """An optional ``start`` / ``end`` query value: ISO 8601 with a time zone, else a 400."""
        if raw in (None, ""):
            return None
        from django.utils.dateparse import parse_datetime
        from django.utils.timezone import is_naive
        from rest_framework.exceptions import ValidationError

        try:
            parsed = parse_datetime(raw)
        except ValueError:
            parsed = None
        if parsed is None:
            raise ValidationError(
                "Send start and end as ISO 8601 date-times, e.g. 2026-11-02T00:00:00Z."
            )
        if is_naive(parsed):
            raise ValidationError(
                "Send the time zone too: end the date-time with Z or add an offset such as +02:00."
            )
        return parsed


class ResourceLeaveSelector(BaseSelector):
    """Read-side data access for resource leaves (platform-global)."""

    model = ResourceLeave

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[Any, Any]:
        return cls.model.objects.select_related(
            "resource",
            "approved_by",
            "rejected_by",
        )

    @classmethod
    def is_approver(cls, user: Any) -> bool:
        """Whether ``user`` may decide leave requests: the approve code, or a superuser."""
        from apps.production.permissions.checks import user_has_permission_code
        from apps.scheduling.constants.permissions import SchedulingPermissions

        return user_has_permission_code(user, SchedulingPermissions.APPROVE)

    @classmethod
    def can_see_details(cls, user: Any, leave: Any, *, approver: bool | None = None) -> bool:
        """
        Whether ``user`` may read the reason of ``leave`` (D-20): the person it is for, or an
        approver. The leave itself (who, when, what type) stays visible for planning.
        """
        if user is None or not getattr(user, "is_authenticated", False):
            return False
        owner_id = getattr(leave.resource, "user_id", None)
        if owner_id is not None and owner_id == user.pk:
            return True
        return cls.is_approver(user) if approver is None else approver


class HolidaySelector(BaseSelector):
    """Read-side data access for holidays (platform-global)."""

    model = Holiday

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[Any, Any]:
        queryset = cls.model.objects.select_related("calendar")
        params = getattr(request, "query_params", None)
        calendar = params.get("calendar_id") if params is not None else None
        if calendar:
            try:
                queryset = queryset.filter(calendar_id=UUID(calendar))
            except ValueError:
                return queryset.none()
        return queryset


class WorkCalendarSelector(BaseSelector):
    """Read-side data access for work calendars (studio-wide)."""

    model = WorkCalendar

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[Any, Any]:
        return cls.model.objects.select_related("office")


class MilestoneSelector(BaseSelector):
    """
    Read-side data access for project milestones, narrowed to the caller's projects.

    Anything else is a 404 exactly like an unknown id. Platform admins see every milestone; a read
    without a request sees none.
    """

    model = Milestone

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[Any, Any]:
        from apps.production.selectors.base import ProductionBaseSelector

        queryset = cls.model.objects.select_related("project", "completed_by")
        visible = ProductionBaseSelector.visible_project_ids(request) if request is not None else []
        if visible is not None:  # None: platform admin, nothing narrows
            queryset = queryset.filter(project_id__in=visible)
        params = getattr(request, "query_params", None)
        project = params.get("project_id") if params is not None else None
        if project:
            try:
                queryset = queryset.filter(project_id=UUID(project))
            except ValueError:
                return queryset.none()
        return queryset
