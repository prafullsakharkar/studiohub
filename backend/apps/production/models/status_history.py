"""
StatusHistory - append-only record of every status change.

A domain record, not an audit diff: it answers "who moved this shot from X to
Y, when and why". Rows are written only by ``StatusService.transition_status``
and are never updated or deleted through the ORM. (Deleting the project
removes them with it, as it does the rest of the project's data.)
"""

from __future__ import annotations

import uuid
from typing import Any

from django.conf import settings
from django.db import models
from django.utils import timezone


class AppendOnlyQuerySet(models.QuerySet[Any]):
    def update(self, **kwargs):
        raise TypeError("StatusHistory is append-only.")

    def delete(self):
        raise TypeError("StatusHistory is append-only.")


class StatusHistory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(
        "production.Project",
        on_delete=models.CASCADE,
        related_name="status_history",
    )
    entity_type = models.CharField(max_length=30)
    entity_id = models.UUIDField()
    # Denormalized so the row stays readable after the entity is deleted.
    entity_code = models.CharField(max_length=100, blank=True, default="")
    from_status = models.CharField(max_length=30, blank=True, default="")
    to_status = models.CharField(max_length=30)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    reason = models.TextField(blank=True, default="")
    # Set when a permission-gated override made the change possible
    # ("status": a fenced move; "self_approval": the actor produced the work).
    override_kind = models.CharField(max_length=40, blank=True, default="", db_index=True)
    changed_at = models.DateTimeField(default=timezone.now, editable=False)

    objects = AppendOnlyQuerySet.as_manager()

    class Meta:
        db_table = "production_status_history"
        ordering = ("-changed_at",)
        indexes = [
            models.Index(fields=["entity_type", "entity_id", "-changed_at"]),
            models.Index(fields=["project", "-changed_at"]),
        ]

    def __str__(self):
        return f"{self.entity_type} {self.entity_code}: {self.from_status} -> {self.to_status}"

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise TypeError("StatusHistory is append-only.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise TypeError("StatusHistory is append-only.")
