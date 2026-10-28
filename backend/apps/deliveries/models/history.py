"""
Status history (DOM-DLV-11): one row per change of a delivery's status, written in the same
transaction as the change. Append-only: separation of duties reads who prepared a delivery from
here, so a later edit must not be able to rewrite it.
"""

from __future__ import annotations

import uuid
from typing import Any

from django.conf import settings
from django.db import models
from django.utils import timezone


class HistoryQuerySet(models.QuerySet[Any]):
    def update(self, **kwargs: Any) -> int:
        raise TypeError("DeliveryStatusChange is append-only.")

    def delete(self) -> tuple[int, dict[str, int]]:
        raise TypeError("DeliveryStatusChange is append-only.")


class DeliveryStatusChange(models.Model):
    class Kind(models.TextChoices):
        NONE = "", "Ordinary move"
        STATUS = "status", "Status override"
        SELF_APPROVAL = "self_approval", "Self sign-off override"
        SYSTEM = "system", "System"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    delivery = models.ForeignKey(
        "deliveries.DeliveryPackage", on_delete=models.PROTECT, related_name="status_changes"
    )
    #: Empty for the row that records the delivery being created.
    from_status = models.CharField(max_length=20, blank=True, default="")
    to_status = models.CharField(max_length=20)
    #: None for a move the system made (a revoked file).
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    reason = models.CharField(max_length=500, blank=True, default="")
    override_kind = models.CharField(
        max_length=20, choices=Kind.choices, blank=True, default=Kind.NONE
    )
    at = models.DateTimeField(default=timezone.now, editable=False)

    objects = HistoryQuerySet.as_manager()

    class Meta:
        db_table = "deliveries_status_change"
        ordering = ("at", "id")
        indexes = [
            models.Index(fields=["delivery", "to_status"], name="deliveries_hist_to_idx"),
        ]

    def save(self, *args: Any, **kwargs: Any) -> None:
        if not self._state.adding:
            raise TypeError("DeliveryStatusChange is append-only.")
        super().save(*args, **kwargs)

    def delete(self, *args: Any, **kwargs: Any) -> tuple[int, dict[str, int]]:
        raise TypeError("DeliveryStatusChange is append-only.")
