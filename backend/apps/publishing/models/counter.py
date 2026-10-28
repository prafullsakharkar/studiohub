"""
Per-project counter for server-made publish codes (CONTRACTS DOM-PUB-05).

Its own row, locked with ``select_for_update`` while a code is taken, so numbering never
needs a lock on Production's project row.
"""

from __future__ import annotations

from django.db import models


class PublishCounter(models.Model):
    project_id = models.UUIDField(primary_key=True)
    last_number = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "publishing_counter"

    def __str__(self) -> str:
        return f"{self.project_id}: {self.last_number}"
