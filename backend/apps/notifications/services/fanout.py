"""
Writing notifications (docs/review-pipeline RP-6, C-RP-24).

``FanoutService.notify`` takes who might be told and why, and writes one row per person who passes
the rules: never the actor, only active people, only those who may open the target now, and one
row per person per event (a mention wins over the other kinds). The handlers call it after the
action has committed; they log and swallow its errors, so a notification never fails the action.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from typing import Any

from django.contrib.auth import get_user_model

from apps.notifications.constants import KIND_PRIORITY
from apps.notifications.models import Notification
from apps.production.selectors.notification_sources import NotificationSources, as_request


def merge(*groups: tuple[Iterable[Any], str]) -> dict[str, str]:
    """
    ``{user_id: kind}`` from ``(user_ids, kind)`` groups: the first kind a person matched, unless a
    later one has priority (a mention).
    """
    kinds: dict[str, str] = {}
    for user_ids, kind in groups:
        for user_id in user_ids:
            if not user_id:
                continue
            key = str(user_id)
            if key not in kinds or (kind in KIND_PRIORITY and kinds[key] not in KIND_PRIORITY):
                kinds[key] = kind
    return kinds


class FanoutService:
    @staticmethod
    def notify(
        *,
        kinds: Mapping[str, str],
        actor_id: Any,
        project_id: Any,
        target_type: str,
        target_id: Any,
        data: Mapping[str, Any] | None = None,
    ) -> list[Notification]:
        """Write the rows for ``kinds`` (``{user_id: kind}``); the rows written."""
        actor = str(actor_id) if actor_id else None
        wanted = {user_id: kind for user_id, kind in kinds.items() if user_id and user_id != actor}
        if not wanted:
            return []
        users = get_user_model().objects.filter(pk__in=list(wanted), is_active=True)
        rows = [
            Notification(
                recipient=user,
                kind=wanted[str(user.pk)],
                actor_id=actor,
                project_id=project_id,
                target_type=target_type,
                target_id=target_id,
                data=dict(data or {}),
            )
            for user in users
            if NotificationSources.readable(as_request(user), target_type, [target_id])
        ]
        return Notification.objects.bulk_create(rows)
