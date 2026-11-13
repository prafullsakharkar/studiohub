"""Marking a person's notifications read or unread (docs/review-pipeline RP-6, C-RP-23)."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from django.db.models import QuerySet
from django.utils import timezone

from apps.notifications.models import Notification


class InboxService:
    @staticmethod
    def mark(row: Notification, *, read: bool) -> Notification:
        """Read (keeping the first time it was read) or unread."""
        if read and row.read_at is None:
            row.read_at = timezone.now()
            row.save(update_fields=["read_at"])
        elif not read and row.read_at is not None:
            row.read_at = None
            row.save(update_fields=["read_at"])
        return row

    @staticmethod
    def mark_all_read(rows: QuerySet[Notification], *, before: datetime | None) -> int:
        """
        Read every unread row of ``rows`` created at or before ``before`` (default now), so a row
        that arrived after the reader's list was fetched stays unread.
        """
        cutoff: Any = before or timezone.now()
        return Notification.objects.filter(
            pk__in=rows.filter(read_at__isnull=True, created_at__lte=cutoff).values("pk")
        ).update(read_at=timezone.now())
