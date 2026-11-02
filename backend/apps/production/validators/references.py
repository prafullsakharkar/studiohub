"""
Same-project reference checks for write paths.

A reference to a record of another project must look exactly like a reference
to a record that does not exist: same status code, same message. Both helpers
raise a field-keyed ``ValidationError`` with ``Unknown <label>.``
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from django.db.models import Model
from rest_framework.exceptions import ValidationError

UNKNOWN_REFERENCE = "Unknown {label}."


def unknown(field: str, label: str) -> ValidationError:
    return ValidationError({field: [UNKNOWN_REFERENCE.format(label=label)]})


def resolve_in_project(
    model: type[Model], project, ref: Any, *, field: str, label: str | None = None
) -> Any:
    """
    The ``model`` row ``ref`` (an instance or a UUID) inside ``project``.

    Soft-deleted rows do not resolve. Raises ``Unknown <label>.`` for a
    malformed, missing, soft-deleted or other-project reference.
    """
    label = label or field.removesuffix("_id")
    pk = getattr(ref, "pk", ref)
    try:
        pk = UUID(str(pk))
    except ValueError:
        raise unknown(field, label) from None
    instance = model._default_manager.filter(pk=pk, project=project).first()
    if instance is None:
        raise unknown(field, label)
    return instance


def require_project_member(project, user, *, field: str, label: str = "user"):
    """
    ``user`` must be an active member of ``project`` (platform admins pass).

    Raises ``Unknown <label>.`` otherwise, like an unknown user id.
    """
    from apps.production.models.project_membership import ProjectMembership
    from apps.production.selectors.base import ProductionBaseSelector

    if user is None:
        return None
    if ProductionBaseSelector.is_platform_admin(user):
        return user
    is_member = ProjectMembership.objects.filter(
        user=user, project=project, is_deleted=False, status__iexact="active"
    ).exists()
    if not is_member:
        raise unknown(field, label)
    return user


def require_assignable_artist(project, data, instance=None):
    """
    A shot's or asset's ``assigned_artist`` must be an active member of its project, like a task's assignee (CR-34).

    Only a *new* artist is checked: a write that leaves the stored artist alone, or sends them back, still goes
    through, so an older record whose artist has since left the project can be edited. Platform admins pass.
    """
    artist = data.get("assigned_artist")
    if artist is None or project is None:
        return
    if instance is not None and getattr(instance, "assigned_artist_id", None) == artist.pk:
        return
    require_project_member(project, artist, field="assigned_artist", label="user")

