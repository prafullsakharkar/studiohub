"""
Which project an audit row belongs to (TPN review TM-012).
"""

from __future__ import annotations

from typing import Any
from uuid import UUID


def as_project_id(value: Any) -> UUID | None:
    """``value`` as a project id, or ``None`` when it is empty or not a UUID."""
    if value in (None, ""):
        return None

    if isinstance(value, UUID):
        return value

    try:
        return UUID(str(value))
    except (ValueError, AttributeError, TypeError):
        return None


def project_id_of(instance: Any) -> UUID | None:
    """The project a model instance belongs to: its ``project_id``, or itself if it is a project."""
    if instance is None:
        return None

    if type(instance).__name__ == "Project":
        return as_project_id(getattr(instance, "pk", None))

    return as_project_id(getattr(instance, "project_id", None))
