"""
Shared lifecycle helpers for masterdata services (DOM-MD-COM-06..10).

Generic over any masterdata model; the directory phases reuse them.
"""

from __future__ import annotations

from typing import Any

from django.db import models

from apps.masterdata.exceptions import MasterdataConflict


def live_dependants(instance: models.Model, *, include_deleted: bool = False) -> dict[str, int]:
    """Count rows that still point at ``instance`` through a foreign key.

    Soft-deleted dependants are ignored by default (they do not block a soft
    delete) and counted for a hard delete, where the database would refuse.
    Returns ``{"app.Model.field": count}`` for non-empty relations only.
    """
    found: dict[str, int] = {}
    for rel in instance._meta.related_objects:
        if not (rel.one_to_many or rel.one_to_one):
            continue
        related = rel.related_model
        manager = related._base_manager if include_deleted else related._default_manager
        count = manager.filter(**{rel.field.name: instance}).count()
        if count:
            found[f"{related._meta.label}.{rel.field.name}"] = count
    return found


def refuse_dependants(instance: models.Model, *, include_deleted: bool = False) -> None:
    found = live_dependants(instance, include_deleted=include_deleted)
    if found:
        raise MasterdataConflict(
            f"Still referenced by: {', '.join(f'{k} ({v})' for k, v in sorted(found.items()))}.",
            code="has_dependants",
        )


def refuse_system_row(instance: Any) -> None:
    if getattr(instance, "is_system", False):
        raise MasterdataConflict(
            "System records cannot be changed this way.", code="system_row_protected"
        )
