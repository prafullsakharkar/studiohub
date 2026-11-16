"""
Milestone reminders (docs/review-pipeline RP-13, C-RP-36, Q-RP-61 = A).

Run hourly from beat. Each run reads today in the studio's time zone and reminds the people of every
milestone due today or tomorrow (stage ``due``) or due in the last week and not completed
(``overdue``): its creator and, for a delivery milestone, the delivery's creator. A person gets each
stage once per due date: a row of the same kind, milestone, stage and due date already written for
them is never written again, so the hourly runs and a moved due date behave. The usual rules apply
(in reach, active, not muted); there is no actor.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from apps.core.logging.logger import get_logger
from apps.deliveries.selectors.notification_sources import DeliveryNotificationSources
from apps.notifications.constants import Kind, TargetType
from apps.notifications.models import Notification
from apps.notifications.services.fanout import FanoutService, merge
from apps.scheduling.selectors.notification_sources import ScheduleNotificationSources

logger = get_logger("notifications")


class ReminderService:
    @staticmethod
    def run(now: datetime | None = None) -> int:
        """Write the reminders due at ``now`` (default: now); the number of rows written."""
        today = ScheduleNotificationSources.studio_today(now)
        written = 0
        for milestone in ScheduleNotificationSources.reminders(today):
            try:
                written += ReminderService._remind(milestone)
            except Exception:
                logger.exception("milestone_reminder_failed", milestone_id=milestone["id"])
        return written

    @staticmethod
    def _remind(milestone: dict[str, Any]) -> int:
        people = [milestone["created_by_id"]]
        if milestone["delivery_id"]:
            people.append(DeliveryNotificationSources.creator(milestone["delivery_id"]))
        kinds = merge((people, Kind.MILESTONE_DUE))
        if not kinds:
            return 0
        data = {"stage": milestone["stage"], "due_date": milestone["due_date"]}
        told = {
            str(pk)
            for pk in Notification.objects.filter(
                kind=Kind.MILESTONE_DUE,
                target_type=TargetType.MILESTONE,
                target_id=milestone["id"],
                recipient_id__in=list(kinds),
                data__stage=data["stage"],
                data__due_date=data["due_date"],
            ).values_list("recipient_id", flat=True)
        }
        kinds = {user_id: kind for user_id, kind in kinds.items() if user_id not in told}
        return len(
            FanoutService.notify(
                kinds=kinds,
                actor_id=None,
                project_id=milestone["project_id"],
                target_type=TargetType.MILESTONE,
                target_id=milestone["id"],
                data=data,
            )
        )
