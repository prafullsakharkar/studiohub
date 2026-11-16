"""
Where each target type's reach and labels come from (docs/review-pipeline RP-6, C-RP-23; RP-13,
C-RP-34).

Every app decides for its own records, in its ``selectors/notification_sources.py``, whether a
person may open one (what the record's own ``GET`` answers) and what to call it. This module only
looks the target type up, so the inbox and the fan-out ask one place and never query another
app's models.
"""

from __future__ import annotations

from collections.abc import Callable, Iterable
from typing import Any
from uuid import UUID

from django.db.models import QuerySet

from apps.deliveries.selectors.notification_sources import DeliveryNotificationSources
from apps.notifications.constants import TargetType
from apps.production.selectors.notification_sources import NotificationSources
from apps.publishing.selectors.notification_sources import PublishingNotificationSources
from apps.scheduling.selectors.notification_sources import ScheduleNotificationSources

_PRODUCTION = (TargetType.NOTE, TargetType.TASK, TargetType.VERSION, TargetType.REVIEW)
_PUBLISHING = (TargetType.PUBLISH_JOB, TargetType.PUBLISHED_FILE)


def _reach(target_type: str) -> Callable[[Any], QuerySet[Any]]:
    if target_type in _PRODUCTION:
        return lambda request: NotificationSources.readable_query(request, target_type)
    if target_type in _PUBLISHING:
        return lambda request: PublishingNotificationSources.readable_query(request, target_type)
    if target_type == TargetType.DELIVERY:
        return DeliveryNotificationSources.readable_query
    if target_type == TargetType.MILESTONE:
        return ScheduleNotificationSources.readable_query
    raise KeyError(target_type)


def _labels(target_type: str) -> Callable[[Iterable[Any]], dict[str, dict[str, Any]]]:
    if target_type in _PRODUCTION:
        return lambda ids: NotificationSources.labels(target_type, ids)
    if target_type in _PUBLISHING:
        return lambda ids: PublishingNotificationSources.labels(target_type, ids)
    if target_type == TargetType.DELIVERY:
        return DeliveryNotificationSources.labels
    if target_type == TargetType.MILESTONE:
        return ScheduleNotificationSources.labels
    raise KeyError(target_type)


#: every target type, with its reach (a subquery of ids) and its labels; built once
REACH = {target_type: _reach(target_type) for target_type in TargetType.values}
LABELS = {target_type: _labels(target_type) for target_type in TargetType.values}


def readable_query(request: Any, target_type: str) -> QuerySet[Any] | None:
    """The ids of every live ``target_type`` record the person of ``request`` may open; ``None`` for an unknown type."""
    reach = REACH.get(target_type)
    return reach(request) if reach is not None else None


def readable(request: Any, target_type: str, ids: Iterable[Any]) -> set[str]:
    """The ids among ``ids`` of live ``target_type`` records the person of ``request`` may open."""
    wanted = []
    for value in ids:
        try:
            wanted.append(UUID(str(value)))
        except (TypeError, ValueError):
            continue
    query = readable_query(request, target_type)
    if not wanted or query is None:
        return set()
    return {str(pk) for pk in query.filter(pk__in=wanted)}


def labels(target_type: str, ids: Iterable[Any]) -> dict[str, dict[str, Any]]:
    """``{id: {"code", "name", "record"}}`` of the live ``target_type`` records ``ids``, read now."""
    found = LABELS.get(target_type)
    return found(ids) if found is not None else {}
