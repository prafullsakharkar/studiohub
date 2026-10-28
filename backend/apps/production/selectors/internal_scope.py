"""
Show and department narrowing of internal project members (TPN review TM-002, ADR-0033 D2).

An internal membership (no vendor, no client) normally covers the whole project. It can be narrowed:

* **Show.** A membership bound to a show (``show``) sees the records of that show: the episodes,
  sequences, shots and assets assigned to it, the tasks on those, and what hangs off the tasks
  (versions, timelogs, reviews containing those versions, media attached to any of it). Records not
  yet assigned to a show are hidden: this module is deny-by-default.
* **Department.** A membership that names a department (``department`` text or ``department_id``)
  sees the project's tasks of that department and what is reached through them: the shot, asset,
  sequence and episode of each task, its versions and timelogs, the reviews containing those
  versions, and the media attached to any of it (the same reach a vendor has).
* **Both** apply together: a record must satisfy each.

Models without a show or task link (workflows, playlists, notes, members, templates) are not narrowed
here: they are project-wide, like for any internal member. A membership with neither a show nor a
department is *full* and is not touched by any of this. Whole-project views (statistics, dashboards,
deliveries, publishing, schedules) are not available to a narrowed member, because their totals
would reveal what the narrowing hides; see ``ProductionBaseSelector.visible_project_ids``.
"""

from __future__ import annotations

from typing import Any, NamedTuple

from django.apps import apps
from django.db.models import CharField, Q, QuerySet
from django.db.models.functions import Cast


class Narrowing(NamedTuple):
    """One narrowed internal membership: what it may be shown on ``project_id``."""

    project_id: Any
    show_id: Any
    department: str
    department_id: str

    @property
    def by_show(self) -> bool:
        return self.show_id is not None

    @property
    def by_department(self) -> bool:
        return bool(self.department or self.department_id)


def is_narrowed(membership: Any) -> bool:
    """Whether ``membership`` (a ``ProjectMembership``) is narrowed by show or department."""
    return bool(
        membership.show_id
        or (membership.department or "").strip()
        or (membership.department_id or "").strip()
    )


def narrowing_of(membership: Any) -> Narrowing:
    return Narrowing(
        project_id=membership.project_id,
        show_id=membership.show_id,
        department=(membership.department or "").strip(),
        department_id=(membership.department_id or "").strip(),
    )


def _model(name: str):
    return apps.get_model("production", name)


def _text_ids(queryset: QuerySet[Any], field: str = "id") -> QuerySet[Any]:
    return queryset.annotate(_text_id=Cast(field, CharField())).values("_text_id")


# Media is narrowed only where it hangs off one of these; media on anything else is project-wide.
_NARROWED_MEDIA_TYPES = ("task", "shot", "asset", "version")


# ---------------------------------------------------------------------------
# Department: what the department's tasks reach
# ---------------------------------------------------------------------------


def department_tasks(n: Narrowing) -> QuerySet[Any]:
    tasks = _model("Task").objects.filter(project_id=n.project_id)
    match = Q(pk__in=[])
    if n.department:
        match |= Q(department__iexact=n.department)
    if n.department_id:
        match |= Q(department_id=n.department_id)
    return tasks.filter(match)


def _dept_shots(n: Narrowing) -> QuerySet[Any]:
    return department_tasks(n).filter(shot_id__isnull=False).values("shot_id")


def _dept_assets(n: Narrowing) -> QuerySet[Any]:
    return department_tasks(n).filter(asset_id__isnull=False).values("asset_id")


def _dept_versions(n: Narrowing) -> QuerySet[Any]:
    return _model("Version").objects.filter(
        project_id=n.project_id, task_id__in=department_tasks(n).values("id")
    )


def _dept_reviews(n: Narrowing) -> QuerySet[Any]:
    item = _model("ReviewItem")
    return _model("Review").objects.filter(
        project_id=n.project_id,
        id__in=item.objects.filter(version_id__in=_dept_versions(n).values("id")).values(
            "review_id"
        ),
    )


def _dept_versions_of(n: Narrowing) -> QuerySet[Any]:
    """The department's versions and every version in a review it reaches."""
    item = _model("ReviewItem")
    return (
        _model("Version")
        .objects.filter(project_id=n.project_id)
        .filter(
            Q(
                id__in=item.objects.filter(review_id__in=_dept_reviews(n).values("id")).values(
                    "version_id"
                )
            )
            | Q(id__in=_dept_versions(n).values("id"))
        )
    )


def _dept_media(n: Narrowing) -> Q:
    shot, asset = _model("Shot"), _model("Asset")
    version = _model("Version")
    return (
        Q(entity_type__iexact="task", entity_id__in=_text_ids(department_tasks(n)))
        | Q(
            entity_type__iexact="shot",
            entity_id__in=_text_ids(shot.objects.filter(id__in=_dept_shots(n))),
        )
        | Q(
            entity_type__iexact="asset",
            entity_id__in=_text_ids(asset.objects.filter(id__in=_dept_assets(n))),
        )
        | Q(
            entity_type__iexact="version",
            entity_id__in=_text_ids(
                version.objects.filter(id__in=_dept_versions_of(n).values("id"))
            ),
        )
    )


def _department_q(model_name: str, n: Narrowing) -> Q | None:
    if model_name == "Task":
        return Q(id__in=department_tasks(n).values("id"))
    if model_name == "Shot":
        return Q(id__in=_dept_shots(n))
    if model_name == "Asset":
        return Q(id__in=_dept_assets(n))
    if model_name == "ShotAsset":
        return Q(shot_id__in=_dept_shots(n)) & Q(asset_id__in=_dept_assets(n))
    if model_name == "Sequence":
        shot = _model("Shot")
        return Q(
            id__in=department_tasks(n).filter(sequence_id__isnull=False).values("sequence_id")
        ) | Q(
            id__in=shot.objects.filter(id__in=_dept_shots(n))
            .filter(sequence_id__isnull=False)
            .values("sequence_id")
        )
    if model_name == "Episode":
        shot = _model("Shot")
        return Q(
            id__in=shot.objects.filter(id__in=_dept_shots(n))
            .filter(episode_id__isnull=False)
            .values("episode_id")
        )
    if model_name == "Timelog":
        return Q(task_id__in=department_tasks(n).values("id"))
    if model_name == "Version":
        return Q(id__in=_dept_versions_of(n).values("id"))
    if model_name == "Review":
        return Q(id__in=_dept_reviews(n).values("id"))
    if model_name == "Media":
        return _dept_media(n) | ~_any_narrowed_media_type()
    return None


# ---------------------------------------------------------------------------
# Show: what is assigned to the show
# ---------------------------------------------------------------------------


def show_tasks(n: Narrowing) -> QuerySet[Any]:
    return (
        _model("Task")
        .objects.filter(project_id=n.project_id)
        .filter(
            Q(shot__show_id=n.show_id)
            | Q(asset__show_id=n.show_id)
            | Q(sequence__show_id=n.show_id)
        )
    )


def _show_versions(n: Narrowing) -> QuerySet[Any]:
    return (
        _model("Version")
        .objects.filter(project_id=n.project_id)
        .filter(
            Q(task_id__in=show_tasks(n).values("id"))
            | Q(shot__show_id=n.show_id)
            | Q(asset__show_id=n.show_id)
        )
    )


def _show_reviews(n: Narrowing) -> QuerySet[Any]:
    item = _model("ReviewItem")
    return _model("Review").objects.filter(
        project_id=n.project_id,
        id__in=item.objects.filter(version_id__in=_show_versions(n).values("id")).values(
            "review_id"
        ),
    )


def _show_media(n: Narrowing) -> Q:
    shot, asset = _model("Shot"), _model("Asset")
    return (
        Q(entity_type__iexact="task", entity_id__in=_text_ids(show_tasks(n)))
        | Q(
            entity_type__iexact="shot",
            entity_id__in=_text_ids(shot.objects.filter(show_id=n.show_id)),
        )
        | Q(
            entity_type__iexact="asset",
            entity_id__in=_text_ids(asset.objects.filter(show_id=n.show_id)),
        )
        | Q(
            entity_type__iexact="version",
            entity_id__in=_text_ids(_show_versions(n)),
        )
    )


def _any_narrowed_media_type() -> Q:
    q = Q(pk__in=[])
    for kind in _NARROWED_MEDIA_TYPES:
        q |= Q(entity_type__iexact=kind)
    return q


def _show_q(model_name: str, n: Narrowing) -> Q | None:
    if model_name in ("Episode", "Sequence", "Shot", "Asset"):
        return Q(show_id=n.show_id)
    if model_name == "Task":
        return Q(id__in=show_tasks(n).values("id"))
    if model_name == "ShotAsset":
        return Q(shot__show_id=n.show_id) & Q(asset__show_id=n.show_id)
    if model_name == "Timelog":
        return Q(task_id__in=show_tasks(n).values("id"))
    if model_name == "Version":
        return Q(id__in=_show_versions(n).values("id"))
    if model_name == "Review":
        return Q(id__in=_show_reviews(n).values("id"))
    if model_name == "Media":
        return _show_media(n) | ~_any_narrowed_media_type()
    return None


def predicate(model_name: str, n: Narrowing) -> Q | None:
    """
    The extra condition a narrowed membership puts on ``model_name`` (on top of "in the project"),
    or ``None`` when the model is project-wide for it.
    """
    parts: list[Q] = []

    if n.by_show:
        part = _show_q(model_name, n)
        if part is not None:
            parts.append(part)

    if n.by_department:
        part = _department_q(model_name, n)
        if part is not None:
            parts.append(part)

    if not parts:
        return None

    combined = parts[0]
    for part in parts[1:]:
        combined &= part
    return combined
