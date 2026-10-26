"""
What a caller may see of the calendar (DECISIONS D-21).

An event is visible when its ``visibility`` allows it:

* ``Private``: its creator only;
* ``Team`` (the default): the members of its project; with no project, everyone who may
  view the schedule (an event has no team of its own to narrow it further);
* ``Organization`` and ``Public``: everyone who may view the schedule.

Its creator always sees it, and platform admins see everything. Tasks and projects behind a
booking follow project membership. ``ViewerScope`` is built once per request and answers
both the SQL side (a filtered queryset) and the per-row side (a single event or task).
"""

from __future__ import annotations

from typing import Any

from django.db.models import Q, QuerySet

#: shown instead of the title of an event or task the caller may not see
RESTRICTED_TITLE = "Booked on another project"


class ViewerScope:
    def __init__(self, user: Any, *, is_admin: bool, project_ids: set[Any]):
        self.user = user
        self.is_admin = is_admin
        self.project_ids = project_ids

    @classmethod
    def of(cls, request: Any) -> ViewerScope:
        from apps.production.selectors.base import ProductionBaseSelector

        user = getattr(request, "user", None)
        if user is None or not getattr(user, "is_authenticated", False):
            return cls(None, is_admin=False, project_ids=set())
        if ProductionBaseSelector.is_platform_admin(user):
            return cls(user, is_admin=True, project_ids=set())
        return cls(
            user,
            is_admin=False,
            project_ids=set(ProductionBaseSelector.visible_project_ids(request) or []),
        )

    # -- events --------------------------------------------------------------

    def filter_events(self, queryset: QuerySet[Any]) -> QuerySet[Any]:
        from apps.scheduling.models import CalendarEvent

        if self.user is None:
            return queryset.none()
        if self.is_admin:
            return queryset
        return queryset.filter(
            Q(created_by=self.user)
            | Q(
                visibility__in=(
                    CalendarEvent.VISIBILITY_ORGANIZATION,
                    CalendarEvent.VISIBILITY_PUBLIC,
                )
            )
            | Q(visibility=CalendarEvent.VISIBILITY_TEAM, project__isnull=True)
            | Q(visibility=CalendarEvent.VISIBILITY_TEAM, project_id__in=self.project_ids)
        )

    def sees_event(self, event: Any) -> bool:
        from apps.scheduling.models import CalendarEvent

        if self.user is None:
            return False
        if self.is_admin or event.created_by_id == self.user.pk:
            return True
        if event.visibility in (
            CalendarEvent.VISIBILITY_ORGANIZATION,
            CalendarEvent.VISIBILITY_PUBLIC,
        ):
            return True
        if event.visibility == CalendarEvent.VISIBILITY_TEAM:
            return event.project_id is None or event.project_id in self.project_ids
        return False

    # -- tasks ---------------------------------------------------------------

    def sees_task(self, task: Any) -> bool:
        return self.user is not None and (self.is_admin or task.project_id in self.project_ids)
