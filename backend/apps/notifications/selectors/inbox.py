"""
Reading a person's inbox (docs/review-pipeline RP-6, C-RP-23).

Own rows only, and only while their target is live and in the reader's reach: the check is one
subquery per target type, through production's selectors, so paging and the unread count both
come after it. Labels are read from the live records for one page at a time.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from django.db.models import Q, QuerySet

from apps.notifications.constants import Kind, TargetType
from apps.notifications.models import Notification
from apps.production.selectors.notification_sources import NotificationSources


class InboxSelector:
    @staticmethod
    def visible(request: Any) -> QuerySet[Notification]:
        """The caller's rows whose target they may open now, newest first."""
        user = getattr(request, "user", None)
        if user is None or not getattr(user, "is_authenticated", False):
            return Notification.objects.none()
        reach = Q()
        for target_type in TargetType.values:
            reach |= Q(
                target_type=target_type,
                target_id__in=NotificationSources.readable_query(request, target_type),
            )
        return (
            Notification.objects.filter(recipient=user)
            .filter(reach)
            .select_related("actor__profile")
            .order_by("-created_at", "-id")
        )

    @staticmethod
    def filtered(rows: QuerySet[Notification], params: Any) -> QuerySet[Notification]:
        """``unread``, ``project_id`` and ``kind``; an unknown value gives no rows (C-RP-23)."""
        unread = params.get("unread")
        if unread is not None:
            flag = str(unread).strip().lower()
            if flag in {"true", "1"}:
                rows = rows.filter(read_at__isnull=True)
            elif flag in {"false", "0"}:
                rows = rows.filter(read_at__isnull=False)
            else:
                return rows.none()
        project_id = params.get("project_id")
        if project_id:
            from uuid import UUID

            try:
                rows = rows.filter(project_id=UUID(str(project_id)))
            except ValueError:
                return rows.none()
        kind = params.get("kind")
        if kind:
            if kind not in Kind.values:
                return rows.none()
            rows = rows.filter(kind=kind)
        return rows

    @staticmethod
    def page_labels(rows: list[Notification]) -> dict[str, Any]:
        """The live labels of one page: one query per target type, and one for the projects."""
        by_type: dict[str, set[str]] = defaultdict(set)
        for row in rows:
            by_type[row.target_type].add(str(row.target_id))
        return {
            "targets": {
                target_type: NotificationSources.labels(target_type, ids)
                for target_type, ids in by_type.items()
            },
            "projects": NotificationSources.projects({row.project_id for row in rows}),  # pyright: ignore[reportAttributeAccessIssue]
        }
