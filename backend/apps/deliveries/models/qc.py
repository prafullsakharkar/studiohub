"""
QC records (DOM-DLV-06): what was checked, by whom, when, and the outcome. Append-only.
"""

from __future__ import annotations

import uuid
from typing import Any

from django.conf import settings
from django.db import models
from django.utils import timezone


class QCQuerySet(models.QuerySet[Any]):
    def update(self, **kwargs: Any) -> int:
        raise TypeError("DeliveryQCCheck is append-only.")

    def delete(self) -> tuple[int, dict[str, int]]:
        raise TypeError("DeliveryQCCheck is append-only.")


class DeliveryQCCheck(models.Model):
    class Outcome(models.TextChoices):
        PASS = "pass", "Pass"
        FAIL = "fail", "Fail"
        NOT_CHECKED = "not_checked", "Not checked"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    delivery = models.ForeignKey(
        "deliveries.DeliveryPackage", on_delete=models.PROTECT, related_name="qc_checks"
    )
    #: None for a check about the whole package. SET_NULL (CR-20): removing an item keeps the rows of the
    #: runs it took part in as history; ``remove_version`` clears the package's current run, so they are
    #: no longer served as its checks.
    item = models.ForeignKey(
        "deliveries.DeliveryVersionRef",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="qc_checks",
    )
    run_id = models.UUIDField(db_index=True)
    check_name = models.CharField(max_length=40)
    outcome = models.CharField(max_length=12, choices=Outcome.choices)
    detail = models.CharField(max_length=300, blank=True, default="")
    checked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    checked_at = models.DateTimeField(default=timezone.now, editable=False)

    objects = QCQuerySet.as_manager()

    class Meta:
        db_table = "deliveries_qc_check"
        ordering = ("checked_at", "check_name")
        indexes = [models.Index(fields=["delivery", "run_id"], name="deliveries_qc_run_idx")]

    def save(self, *args: Any, **kwargs: Any) -> None:
        if not self._state.adding:
            raise TypeError("DeliveryQCCheck is append-only.")
        super().save(*args, **kwargs)

    def delete(self, *args: Any, **kwargs: Any) -> tuple[int, dict[str, int]]:
        raise TypeError("DeliveryQCCheck is append-only.")
