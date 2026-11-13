"""
Read side of path templates (review-pipeline RP-4, C-RP-18).

``applicable`` is the template a file of a version would follow: the project's own active
template for the file type and role, else the studio's (Q-RP-23 = A). ``version_values`` is what
the tokens of ``domain/templates.py`` are filled with.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from django.db.models import Q, QuerySet

from apps.core.selectors.base import BaseSelector
from apps.production.selectors.base import ProductionBaseSelector
from apps.publishing.models import PublishPathTemplate


class PathTemplateSelector(BaseSelector):
    model = PublishPathTemplate

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[PublishPathTemplate]:
        """Studio templates, and the templates of the projects the caller fully belongs to."""
        qs = PublishPathTemplate.objects.select_related("project", "file_type", "storage_root")
        visible = ProductionBaseSelector.visible_project_ids(request) if request else []
        if visible is not None:
            qs = qs.filter(Q(project__isnull=True) | Q(project_id__in=visible))
        params = getattr(request, "query_params", None)
        if params is None:
            return qs
        project = params.get("project_id")
        if project:
            if project.lower() in {"null", "none", "studio"}:
                qs = qs.filter(project__isnull=True)
            else:
                try:
                    qs = qs.filter(project_id=UUID(project))
                except ValueError:
                    return qs.none()
        if params.get("file_type"):
            qs = qs.filter(file_type__code__iexact=params["file_type"])
        if params.get("role"):
            qs = qs.filter(role=params["role"])
        active = str(params.get("is_active", "")).lower()
        if active in {"true", "1", "yes"}:
            qs = qs.filter(is_active=True)
        elif active in {"false", "0", "no"}:
            qs = qs.filter(is_active=False)
        return qs

    @classmethod
    def applicable(
        cls, *, project_id: Any, file_type_id: Any, role: str
    ) -> PublishPathTemplate | None:
        rows = PublishPathTemplate.objects.filter(
            file_type_id=file_type_id, role=role, is_active=True
        ).select_related("storage_root", "file_type")
        return (
            rows.filter(project_id=project_id).first() or rows.filter(project__isnull=True).first()
        )


def version_values(version: Any, file_type: Any) -> dict[str, str | int | None]:
    """The token values of ``version`` for a file of ``file_type`` (blank when the version has none)."""
    shot = getattr(version, "shot", None)
    asset = getattr(version, "asset", None)
    task = getattr(version, "task", None)
    sequence = getattr(shot, "sequence", None) if shot else None
    if sequence is None and task is not None:
        sequence = getattr(task, "sequence", None)
    episode = getattr(shot, "episode", None) if shot else None
    if episode is None and sequence is not None:
        episode = getattr(sequence, "episode", None)
    asset_type = getattr(asset, "asset_type", None) if asset else None
    department = version.department or (getattr(task, "department", "") if task else "")
    return {
        "project": version.project.code,
        "episode": getattr(episode, "code", None),
        "sequence": getattr(sequence, "code", None),
        "shot": getattr(shot, "code", None),
        "asset": getattr(asset, "code", None),
        "asset_type": getattr(asset_type, "code", None),
        "task": getattr(task, "code", None),
        "department": department or None,
        "version": version.version_index,
        "ext": (getattr(file_type, "extension", "") or "").lstrip(".") or None,
    }


__all__ = ["PathTemplateSelector", "version_values"]
