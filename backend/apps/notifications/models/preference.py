"""
What a person does not want to be told (docs/review-pipeline RP-11, C-RP-30, Q-RP-48 and Q-RP-49 = A).

One row per person, written on their first save. A muted kind is not written for them at all
(``FanoutService``); unmuting brings back nothing. ``note_mention`` and ``review_invited`` cannot be
muted (``UNMUTABLE_KINDS``). A person without a row mutes nothing.
"""

from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils import timezone


class NotificationPreference(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        primary_key=True,
        related_name="notification_preference",
    )
    #: kind values, in the kinds' order, each once
    muted_kinds = models.JSONField(default=list, blank=True)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "notifications_preference"

    def __str__(self) -> str:
        return f"preferences of {self.user_id}"  # pyright: ignore[reportAttributeAccessIssue]
