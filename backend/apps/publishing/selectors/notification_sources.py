"""
What the in-app notifications read from publishing (docs/review-pipeline RP-13, C-RP-34, C-RP-35).

The notifications app never queries this app's models: it asks here who is involved in a publish
job or a published file, whether a person may open one ("in reach"), and what to call it. Reach is
what ``GET publishing/{id}/`` and ``GET publishing/files/{id}/`` answer: ``publishing.view`` and
the projects their selectors narrow to (full internal access; every project for a platform
administrator). A job that names no project is never told: a notification belongs to a project.
"""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any
from uuid import UUID

from django.db.models import QuerySet

from apps.production.permissions.checks import has_permission_code
from apps.production.selectors.base import ProductionBaseSelector
from apps.publishing.constants.permissions import PublishPermissions
from apps.publishing.models import PublishedFile, PublishedFileDependency, PublishItem
from apps.publishing.selectors.publish import PublishSelector

PUBLISH_JOB = "publish_job"
PUBLISHED_FILE = "published_file"


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


class PublishingNotificationSources:
    # ------------------------------------------------------------------ who is involved

    @staticmethod
    def job(job_id: Any) -> dict[str, Any] | None:
        """
        The live job ``job_id``: ``project_id``, ``created_by_id`` and ``version_id`` (or ``None``);
        ``None`` if it is gone or names no project.
        """
        ids = _uuids([job_id])
        row = (
            PublishItem.objects.filter(pk=ids[0], project__isnull=False)
            .values("project_id", "created_by_id", "version_id")
            .first()
            if ids
            else None
        )
        if row is None:
            return None
        return {
            "project_id": str(row["project_id"]),
            "created_by_id": _sid(row["created_by_id"]),
            "version_id": _sid(row["version_id"]),
        }

    @staticmethod
    def file(file_id: Any) -> dict[str, Any] | None:
        """
        The live file ``file_id``: ``project_id``, ``version_id``, ``created_by_id`` and the
        creators of the live files built from it (``downstream_creator_ids``, each once); ``None``
        if it is gone.
        """
        ids = _uuids([file_id])
        row = (
            PublishedFile.objects.filter(pk=ids[0])
            .values("project_id", "version_id", "created_by_id")
            .first()
            if ids
            else None
        )
        if row is None:
            return None
        downstream = (
            PublishedFileDependency.objects.filter(
                upstream_id=ids[0],
                downstream__is_deleted=False,
                downstream__created_by__isnull=False,
            )
            .values_list("downstream__created_by_id", flat=True)
            .distinct()
        )
        return {
            "project_id": str(row["project_id"]),
            "version_id": str(row["version_id"]),
            "created_by_id": _sid(row["created_by_id"]),
            "downstream_creator_ids": [str(pk) for pk in downstream],
        }

    # ------------------------------------------------------------------ reach

    @staticmethod
    def readable_query(request: Any, target_type: str) -> QuerySet[Any]:
        """
        The ids of every live job (``publish_job``) or file (``published_file``) the person of
        ``request`` may open, as a subquery.
        """
        model = {PUBLISH_JOB: PublishItem, PUBLISHED_FILE: PublishedFile}.get(target_type)
        user = getattr(request, "user", None)
        if (
            model is None
            or user is None
            or not getattr(user, "is_authenticated", False)
            or not getattr(user, "is_active", False)
            or not has_permission_code(request, PublishPermissions.VIEW)
        ):
            return PublishItem.objects.none().values_list("pk", flat=True)
        if target_type == PUBLISH_JOB:
            return (
                PublishSelector.get_queryset(request=request)
                .filter(project__isnull=False)
                .values_list("pk", flat=True)
            )
        # ``PublishedFileSelector``'s project rule, without the list route's query-string filters
        # (the inbox's own ``project_id`` must not narrow reach)
        files = PublishedFile.objects.all()
        visible = ProductionBaseSelector.visible_project_ids(request)
        if visible is not None:  # None: platform admin, nothing narrows
            files = files.filter(project_id__in=visible)
        return files.values_list("pk", flat=True)

    # ------------------------------------------------------------------ labels

    @staticmethod
    def labels(target_type: str, ids: Iterable[Any]) -> dict[str, dict[str, Any]]:
        """
        ``{id: {"code", "name", "record"}}`` for the live ``target_type`` records ``ids``, read now:
        a job's code and name; a file's version code and the last part of its path.
        """
        wanted = _uuids(ids)
        if not wanted:
            return {}
        if target_type == PUBLISH_JOB:
            rows = PublishItem.objects.filter(pk__in=wanted).values_list("pk", "code", "name")
            return {
                str(pk): {"code": code, "name": name, "record": None} for pk, code, name in rows
            }
        if target_type == PUBLISHED_FILE:
            files = PublishedFile.objects.filter(pk__in=wanted).values_list(
                "pk", "version__code", "relative_path"
            )
            return {
                str(pk): {
                    "code": code or "",
                    "name": (path or "").rstrip("/").rsplit("/", 1)[-1],
                    "record": None,
                }
                for pk, code, path in files
            }
        return {}
