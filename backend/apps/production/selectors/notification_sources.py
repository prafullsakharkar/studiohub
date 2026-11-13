"""
What the in-app notifications read from production (docs/review-pipeline RP-6, C-RP-23, C-RP-24).

The notifications app never queries production's models: it asks here who is involved in a record,
whether a person may open it ("in reach"), and what to call it. Reach is what the record's own
``GET`` would answer:

- a note thread: ``project.view`` and whole-project access (C-RP-10);
- a task: ``task.view`` and the narrowing of ``GET tasks/{id}/``;
- a version: ``version.view`` and the narrowing of ``GET versions/{id}/``.

The person must be active. ``request`` is the caller's request when the inbox is read (so an API
key's or token's scopes count), or a stand-in holding only the recipient when a row is written.
"""

from __future__ import annotations

from collections.abc import Iterable
from types import SimpleNamespace
from typing import Any
from uuid import UUID

from django.db.models import QuerySet

from apps.production.constants.permissions import (
    ProjectPermissions,
    TaskPermissions,
    VersionPermissions,
)
from apps.production.models import Project, ProjectNote, Task, Version
from apps.production.permissions.checks import has_permission_code
from apps.production.selectors.base import ProductionBaseSelector

NOTE = "note"
TASK = "task"
VERSION = "version"
TARGET_TYPES = (NOTE, TASK, VERSION)

#: the stored first link / denormalized entity that means "no record"
_NO_RECORD = {"", "project"}


def as_request(user: Any) -> Any:
    """A stand-in request for reach checks made on behalf of ``user`` (no credential scopes)."""
    return SimpleNamespace(user=user, auth=None)


def _uuids(values: Iterable[Any]) -> list[UUID]:
    found = []
    for value in values:
        try:
            found.append(UUID(str(value)))
        except (TypeError, ValueError):
            continue
    return found


def _sid(value: Any) -> str | None:
    return str(value) if value else None


class NotificationSources:
    # ------------------------------------------------------------------ who is involved

    @staticmethod
    def thread(thread_id: Any) -> dict[str, Any] | None:
        """
        The live thread ``thread_id``: ``project_id``, ``author_id``, the ids of everyone who wrote
        a live reply (oldest first), and the assignee of its task; ``None`` if it is gone.
        """
        ids = _uuids([thread_id])
        if not ids:
            return None
        note = (
            ProjectNote.objects.filter(pk=ids[0], parent__isnull=True)
            .select_related("task")
            .first()
        )
        if note is None:
            return None
        repliers = (
            ProjectNote.objects.filter(parent=note)
            .order_by("created_at", "id")
            .values_list("author_id", flat=True)
        )
        task = note.task if note.task_id and not note.task.is_deleted else None  # pyright: ignore[reportAttributeAccessIssue, reportOptionalMemberAccess]
        return {
            "project_id": str(note.project_id),  # pyright: ignore[reportAttributeAccessIssue]
            "author_id": _sid(note.author_id),  # pyright: ignore[reportAttributeAccessIssue]
            "reply_author_ids": [str(pk) for pk in repliers if pk],
            "task_assignee_id": _sid(task.assignee_id) if task else None,  # pyright: ignore[reportAttributeAccessIssue]
        }

    @staticmethod
    def version_artists(version_ids: Iterable[Any]) -> list[str]:
        """The artists of the live versions ``version_ids`` (each once, in no set order)."""
        artists = (
            Version.objects.filter(pk__in=_uuids(version_ids), artist__isnull=False)
            .values_list("artist_id", flat=True)
            .distinct()
        )
        return [str(pk) for pk in artists]

    @staticmethod
    def task(task_id: Any) -> dict[str, Any] | None:
        """The live task ``task_id``: ``project_id`` and ``assignee_id``; ``None`` if it is gone."""
        ids = _uuids([task_id])
        row = (
            Task.objects.filter(pk=ids[0]).values("project_id", "assignee_id").first()
            if ids
            else None
        )
        if row is None:
            return None
        return {"project_id": str(row["project_id"]), "assignee_id": _sid(row["assignee_id"])}

    @staticmethod
    def version(version_id: Any) -> dict[str, Any] | None:
        """
        The live version ``version_id``: ``project_id``, ``artist_id`` and the assignee of its live
        task; ``None`` if it is gone.
        """
        ids = _uuids([version_id])
        version = Version.objects.filter(pk=ids[0]).select_related("task").first() if ids else None
        if version is None:
            return None
        task = version.task if version.task_id and not version.task.is_deleted else None  # pyright: ignore[reportAttributeAccessIssue, reportOptionalMemberAccess]
        return {
            "project_id": str(version.project_id),  # pyright: ignore[reportAttributeAccessIssue]
            "artist_id": _sid(version.artist_id),  # pyright: ignore[reportAttributeAccessIssue]
            "task_assignee_id": _sid(task.assignee_id) if task else None,  # pyright: ignore[reportAttributeAccessIssue]
        }

    # ------------------------------------------------------------------ reach

    @classmethod
    def readable_query(cls, request: Any, target_type: str) -> QuerySet[Any]:
        """
        The ids of every live ``target_type`` record the person of ``request`` may open, as a
        queryset (used as a subquery, so the inbox pages and counts after the check).
        """
        user = getattr(request, "user", None)
        model = {NOTE: ProjectNote, TASK: Task, VERSION: Version}.get(target_type)
        if (
            model is None
            or user is None
            or not getattr(user, "is_authenticated", False)
            or not getattr(user, "is_active", False)
        ):
            return Task.objects.none().values_list("pk", flat=True)
        code = {
            NOTE: ProjectPermissions.VIEW,
            TASK: TaskPermissions.VIEW,
            VERSION: VersionPermissions.VIEW,
        }[target_type]
        if not has_permission_code(request, code):
            return model.objects.none().values_list("pk", flat=True)
        rows = model.objects.all()
        if target_type == NOTE:
            rows = rows.filter(parent__isnull=True)
            if not ProductionBaseSelector.is_platform_admin(user):
                # whole-project access, as every notes route asks (C-RP-10)
                rows = rows.filter(
                    project_id__in=ProductionBaseSelector._full_memberships(user).values(
                        "project_id"
                    )
                )
        return ProductionBaseSelector.scope_by_project_membership(
            rows, request=request
        ).values_list("pk", flat=True)

    @classmethod
    def readable(cls, request: Any, target_type: str, ids: Iterable[Any]) -> set[str]:
        """The ids among ``ids`` of live ``target_type`` records the person of ``request`` may open."""
        wanted = _uuids(ids)
        if not wanted:
            return set()
        return {str(pk) for pk in cls.readable_query(request, target_type).filter(pk__in=wanted)}

    @classmethod
    def may_read_thread(cls, user: Any, project: Any) -> bool:
        """Whether ``user`` could read any thread of ``project`` (who may be mentioned, C-RP-25)."""
        request = as_request(user)
        if not getattr(user, "is_active", False):
            return False
        return has_permission_code(
            request, ProjectPermissions.VIEW
        ) and ProductionBaseSelector.user_has_full_project_access(request=request, project=project)

    # ------------------------------------------------------------------ labels

    @staticmethod
    def _record(entity_type: str, entity_id: str, entity_code: str) -> dict[str, Any] | None:
        if (entity_type or "").strip().lower() in _NO_RECORD or not entity_id:
            return None
        return {"type": entity_type, "id": entity_id, "code": entity_code}

    @classmethod
    def labels(cls, target_type: str, ids: Iterable[Any]) -> dict[str, dict[str, Any]]:
        """
        ``{id: {"code", "name", "record"}}`` for the live ``target_type`` records ``ids``, read now.
        ``record`` is what the target is about (C-RP-23), or ``None``.
        """
        wanted = _uuids(ids)
        if not wanted:
            return {}
        fields = ("pk", "entity_type", "entity_id", "entity_code")
        if target_type == NOTE:
            rows = ProjectNote.objects.filter(pk__in=wanted).values_list(*fields, "subject")
            return {
                str(pk): {"code": "", "name": subject, "record": cls._record(et, eid, ec)}
                for pk, et, eid, ec, subject in rows
            }
        if target_type == TASK:
            rows = Task.objects.filter(pk__in=wanted).values_list(*fields, "code", "title")
            return {
                str(pk): {"code": code, "name": title, "record": cls._record(et, eid, ec)}
                for pk, et, eid, ec, code, title in rows
            }
        if target_type == VERSION:
            rows = Version.objects.filter(pk__in=wanted).values_list(
                *fields, "code", "version_number"
            )
            return {
                str(pk): {"code": code, "name": number, "record": cls._record(et, eid, ec)}
                for pk, et, eid, ec, code, number in rows
            }
        return {}

    @staticmethod
    def projects(ids: Iterable[Any]) -> dict[str, dict[str, Any]]:
        """``{id: {"id", "code", "name"}}`` of the projects ``ids``."""
        rows = Project.all_objects.filter(pk__in=_uuids(ids)).values_list("pk", "code", "name")
        return {str(pk): {"id": str(pk), "code": code, "name": name} for pk, code, name in rows}
