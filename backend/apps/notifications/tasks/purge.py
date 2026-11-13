"""
The daily purge of old notifications (docs/review-pipeline RP-6, Q-RP-38 = A).

Runs from beat on the default queue. Rows older than ``NOTIFICATIONS_RETENTION_DAYS`` go, read or
not: the inbox is not a record; the records and the change log are.
"""

from __future__ import annotations

from celery import shared_task

from apps.notifications.services.purge import PurgeService


@shared_task(name="notifications.purge", ignore_result=True)
def purge_notifications() -> int:
    return PurgeService.purge()
