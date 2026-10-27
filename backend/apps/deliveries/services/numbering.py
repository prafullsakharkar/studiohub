"""
Server-made delivery codes (docs/deliveries/CONTRACTS.md DOM-DLV-01).
"""

from __future__ import annotations

from typing import Any

from django.db import transaction
from django.db.models.functions import Upper

from apps.deliveries.models import DeliveryCounter, DeliveryPackage

_MAX_TRIES = 1000


def code_in_use(code: str, *, exclude_pk: Any = None) -> bool:
    """Whether a delivery (soft-deleted ones included) already has this code, in any case."""
    rows = DeliveryPackage.all_objects.annotate(ucode=Upper("code")).filter(ucode=code.upper())
    if exclude_pk is not None:
        rows = rows.exclude(pk=exclude_pk)
    return rows.exists()


@transaction.atomic
def allocate_code(project: Any) -> str:
    """
    The next ``DLV-<project code>-<number>`` for a project.

    Takes a lock on the project's own counter row, so two requests never get the same number and
    Production's project row is never locked. A number whose code is already taken (a hand-typed
    code of the same shape) is skipped.
    """
    DeliveryCounter.objects.get_or_create(project_id=project.pk)
    counter = DeliveryCounter.objects.select_for_update().get(pk=project.pk)
    for _ in range(_MAX_TRIES):
        counter.last_number += 1
        code = f"DLV-{project.code.upper()}-{counter.last_number:04d}"
        if not code_in_use(code):
            counter.save(update_fields=["last_number"])
            return code
    raise RuntimeError("No free delivery code could be allocated.")  # pragma: no cover
