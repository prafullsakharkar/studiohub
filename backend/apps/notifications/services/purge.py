"""Deleting notifications older than the retention (docs/review-pipeline RP-6, Q-RP-38 = A)."""

from __future__ import annotations

from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from apps.core.logging.logger import get_logger
from apps.notifications.constants import DEFAULT_RETENTION_DAYS
from apps.notifications.models import Notification

logger = get_logger("notifications")

#: rows deleted per statement, so one purge never holds a long lock
BATCH = 5000


class PurgeService:
    @staticmethod
    def purge(*, now=None) -> int:
        """Delete rows created before ``now`` minus the retention, in batches; how many went."""
        days = getattr(settings, "NOTIFICATIONS_RETENTION_DAYS", DEFAULT_RETENTION_DAYS)
        cutoff = (now or timezone.now()) - timedelta(days=days)
        total = 0
        while True:
            ids = list(
                Notification.objects.filter(created_at__lt=cutoff).values_list("pk", flat=True)[
                    :BATCH
                ]
            )
            if not ids:
                break
            deleted, _ = Notification.objects.filter(pk__in=ids).delete()
            total += deleted
        if total:
            logger.info("notifications_purged", deleted=total, retention_days=days)
        return total
