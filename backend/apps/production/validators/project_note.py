"""
The records and the task a project note names (docs/review-pipeline C-RP-07, RP-2 WP 2.2).

A link or a task must be a live record of the note's project that the writer can see under the
narrowing of its own list route (``ProductionBaseSelector.scope_by_project_membership``). Anything
else (no such record, another project's, an archived one, a malformed id, one outside the writer's
narrowing) gets the same field-keyed 400, so the answer never tells which records exist.
"""

from __future__ import annotations

from typing import Any, NamedTuple
from uuid import UUID

from rest_framework.exceptions import ValidationError

from apps.production.models import ProjectNoteLinkType

LINK_CAP = 20
LINKS_NOT_IN_PROJECT = "One of these records is not in the project."
TOO_MANY_LINKS = f"A note links to at most {LINK_CAP} records."
TASK_NOT_IN_PROJECT = "This task is not in the project."
# The value a note without a record keeps in ``entity_type`` (the model's default).
NO_RECORD = "Project"


class ResolvedLink(NamedTuple):
    entity_type: str
    instance: Any


def link_model(entity_type: str):
    from django.apps import apps

    return apps.get_model("production", entity_type)


def visible(model, *, project, pk, request):
    """The live ``model`` row ``pk`` of ``project`` that the caller can see, or ``None``."""
    from apps.production.selectors.base import ProductionBaseSelector

    qs = model.objects.filter(project=project, pk=pk)
    return ProductionBaseSelector.scope_by_project_membership(qs, request=request).first()


def _uuid(raw: Any) -> UUID | None:
    try:
        return UUID(str(raw).strip())
    except (TypeError, ValueError, AttributeError):
        return None


def resolve_links(raw: list[dict[str, Any]], *, project, request) -> list[ResolvedLink]:
    """
    ``raw`` (``{entity_type, entity_id}`` items, in the order written) as resolved records.

    A repeated record is kept once, at its first place. More than ``LINK_CAP`` items is a 400.
    """
    if len(raw) > LINK_CAP:
        raise ValidationError({"links": [TOO_MANY_LINKS]})
    refused = ValidationError({"links": [LINKS_NOT_IN_PROJECT]})
    resolved: list[ResolvedLink] = []
    seen: set[tuple[str, UUID]] = set()
    for item in raw:
        entity_type = str(item.get("entity_type") or "").strip()
        if entity_type not in ProjectNoteLinkType.values:
            raise refused
        pk = _uuid(item.get("entity_id"))
        if pk is None:
            raise refused
        if (entity_type, pk) in seen:
            continue
        instance = visible(link_model(entity_type), project=project, pk=pk, request=request)
        if instance is None:
            raise refused
        seen.add((entity_type, pk))
        resolved.append(ResolvedLink(entity_type, instance))
    return resolved


def legacy_link(data: dict[str, Any]) -> list[dict[str, Any]]:
    """
    The old ``entity_type`` + ``entity_id`` pair as one link item, or none.

    ``entity_type`` ``Project`` (or empty) means the note is on the project as a whole.
    """
    entity_type = str(data.get("entity_type") or "").strip()
    if not entity_type or entity_type == NO_RECORD:
        return []
    return [{"entity_type": entity_type, "entity_id": data.get("entity_id")}]


def resolve_task(raw: Any, *, project, request):
    """The task ``raw`` names (``None`` for none), checked like a link."""
    from apps.production.models import Task

    if raw is None or raw == "":
        return None
    pk = _uuid(raw)
    task = visible(Task, project=project, pk=pk, request=request) if pk is not None else None
    if task is None:
        raise ValidationError({"task_id": [TASK_NOT_IN_PROJECT]})
    return task


def record_code(instance: Any) -> str:
    return str(getattr(instance, "code", "") or "")


def record_name(instance: Any) -> str:
    return str(getattr(instance, "name", "") or getattr(instance, "title", "") or "")
