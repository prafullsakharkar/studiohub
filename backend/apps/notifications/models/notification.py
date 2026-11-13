"""
One in-app notification (docs/review-pipeline RP-6, C-RP-23, Q-RP-35 = A).

A row keeps ids, its kind and status names only (``data``), never text a person typed. Labels are
read from the live records when the inbox is answered, so an edit shows and a deleted record drops
out. Rows are written by ``FanoutService`` and change only by being read, unread or purged.
"""

from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.notifications.constants import Kind, TargetType


class Notification(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications"
    )
    kind = models.CharField(max_length=32, choices=Kind.choices)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    project = models.ForeignKey("production.Project", on_delete=models.CASCADE, related_name="+")
    target_type = models.CharField(max_length=16, choices=TargetType.choices)
    target_id = models.UUIDField()
    #: ids and status names only: ``from_status``, ``to_status``, ``error_code``
    data = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "notifications_notification"
        ordering = ("-created_at", "-id")
        indexes = [
            models.Index(
                fields=["recipient", "read_at", "-created_at"], name="notif_recipient_read_idx"
            ),
            models.Index(fields=["created_at"], name="notif_created_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.kind} -> {self.recipient_id}"  # pyright: ignore[reportAttributeAccessIssue]
