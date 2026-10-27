"""
Per-project counter for server-made delivery codes (docs/deliveries/CONTRACTS.md DOM-DLV-01).

Its own row, locked with ``select_for_update`` while a code is taken, so numbering never needs a
lock on Production's project row.
"""

from __future__ import annotations

from django.db import models


class DeliveryCounter(models.Model):
    project_id = models.UUIDField(primary_key=True)
    last_number = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "deliveries_counter"

    def __str__(self) -> str:
        return f"{self.project_id}: {self.last_number}"
