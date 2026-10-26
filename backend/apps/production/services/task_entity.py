"""
What a task is about (WP D2, DECISIONS D-28): naming it, resolving it, checking it.

A task may be about one shot, asset or sequence of its own project, or about none (a General,
project-level task). Clients name it with ``entity_type`` and ``entity_id`` (an id or a code); this
turns that into the link and the text copies, or a 400. An empty ``entity_id`` means no record.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from rest_framework.exceptions import ValidationError

from apps.production.models import Asset, Sequence, Shot

KINDS: dict[str, tuple[str, type, str]] = {
    "shot": ("Shot", Shot, "shot"),
    "asset": ("Asset", Asset, "asset"),
    "sequence": ("Sequence", Sequence, "sequence"),
}
NONE_WORDS = {"", "general", "project", "none"}
LINK_FIELDS = ("shot", "asset", "sequence")


def find_in_project(model: type, project: Any, ref: Any) -> Any:
    """The live ``model`` row of ``project`` named by id or code (any case), or None."""
    text = str(ref or "").strip()
    if not text or project is None:
        return None
    base = model.objects.filter(project=project)  # pyright: ignore[reportAttributeAccessIssue]
    try:
        return base.filter(pk=UUID(text)).first()
    except ValueError:
        return base.filter(code__iexact=text).first()


def resolve_entity_fields(
    project: Any, raw_type: Any, raw_id: Any, sent: dict[str, Any]
) -> dict[str, Any]:
    """
    The fields to store for a task about ``raw_type`` / ``raw_id`` in ``project``.

    Returns the link (``shot`` / ``asset`` / ``sequence``, two of them None) and the derived text
    (``entity_type``, ``entity_id``, ``entity_code``, ``entity_name``). ``sent`` holds what the client
    sent for ``entity_code`` / ``entity_name``: it must agree with the record, or be empty.
    """
    kind = str(raw_type or "").strip().lower()
    ref = str(raw_id or "").strip()
    cleared = {name: None for name in LINK_FIELDS}
    if not ref and (kind in NONE_WORDS or kind in KINDS):
        # No record named: a General task, whatever type came with it (an empty id has always been
        # the "no record" state; the model's own default is type Shot with no id).
        derived = {
            **cleared,
            "entity_type": "General",
            "entity_id": "",
            "entity_code": "",
            "entity_name": "",
        }
        noun = "general task"
    else:
        if kind in NONE_WORDS:
            kind = "shot"  # an id with no type has always meant a shot
        if kind not in KINDS:
            raise ValidationError({"entity_type": ["Use Shot, Asset, Sequence or General."]})
        title, model, link = KINDS[kind]
        if project is None:
            raise ValidationError(
                {"entity_id": ["A project is required to link a shot, asset or sequence."]}
            )
        entity = find_in_project(model, project, ref)
        if entity is None:
            raise ValidationError({"entity_id": [f"Unknown {kind}."]})
        derived = {
            **cleared,
            link: entity,
            "entity_type": title,
            "entity_id": str(entity.pk),
            "entity_code": entity.code,
            "entity_name": getattr(entity, "name", "") or "",
        }
        noun = kind
    for key in ("entity_code", "entity_name"):
        given = str(sent.get(key) or "").strip()
        if given and given.lower() != str(derived[key]).lower():
            raise ValidationError({key: [f"Derived from the linked {noun}."]})
    return derived
