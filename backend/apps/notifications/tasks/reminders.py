"""
The hourly milestone reminders (docs/review-pipeline RP-13, C-RP-36).

Runs from beat on the default queue. Hourly, so a reminder arrives soon after the studio's day
begins whatever its time zone; each person gets each reminder once.
"""

from __future__ import annotations

from celery import shared_task

from apps.notifications.services.reminders import ReminderService


@shared_task(name="notifications.milestone_reminders", ignore_result=True)
def milestone_reminders() -> int:
    return ReminderService.run()
