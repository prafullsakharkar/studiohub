"""
Shot grades exported as a ``.ccc`` file (review-pipeline RP-27, C-RP-62; Q-RP-121 to Q-RP-124).

``GET projects/{id}/grades/export/`` answers the project's live shots that have a grade, among those
the caller reads (the shots list's scoping, passed in as ``scope``), ordered by code, as one
``ColorCorrectionCollection``: each correction's id is the shot's code, its description the file the
grade was imported from. ``sequence_id`` narrows it to one sequence; an unknown or malformed id gives
an empty collection, never a 400. Each export is an ``export`` audit row on the project (Q-RP-124).

The values are written as stored (six places), so importing the file again changes nothing.
"""

from __future__ import annotations

import uuid
from typing import Any

from django.db.models import QuerySet

from apps.audit.models import AuditLog
from apps.core.utils.client_ip import get_client_ip
from apps.production.models import Shot
from apps.production.transcode import cdl


def export_name(project: Any) -> str:
    """The file's name: the project's code, then ``_grades.ccc``."""
    return f"{project.code}_grades.ccc"


def _shots(count: int) -> str:
    return f"{count} shot" if count == 1 else f"{count} shots"


class GradeExportService:
    @staticmethod
    def shots(*, project: Any, scope: QuerySet[Shot], sequence_id: str | None) -> QuerySet[Shot]:
        """The graded live shots of ``project`` in ``scope``, ordered by code, narrowed to one sequence."""
        shots = scope.filter(project=project, is_deleted=False).exclude(grade__isnull=True)
        if sequence_id:
            try:
                shots = shots.filter(sequence_id=uuid.UUID(str(sequence_id)))
            except (ValueError, TypeError):
                return shots.none()
        return shots.order_by("code")

    @classmethod
    def export(
        cls,
        *,
        actor: Any,
        project: Any,
        scope: QuerySet[Shot],
        sequence_id: str | None,
        request: Any,
    ) -> tuple[str, bytes]:
        """The file's name and bytes; records the export."""
        entries = [
            cdl.Entry(shot.code, shot.grade, shot.grade_source)
            for shot in cls.shots(project=project, scope=scope, sequence_id=sequence_id)
            if shot.grade
        ]
        name = export_name(project)
        AuditLog.objects.create(
            action=AuditLog.ACTION_EXPORT,
            target_type=AuditLog.TARGET_PROJECT,
            target_id=str(project.pk),
            target_name=str(project.code)[:255],
            project_id=project.pk,
            description=f"Exported the grades of {_shots(len(entries))} as {name}."[:1000],
            actor_id=getattr(actor, "pk", None),
            ip_address=get_client_ip(request) or None,
            metadata={
                "operation": "grades_export",
                "file_name": name,
                "sequence_id": str(sequence_id) if sequence_id else None,
                "shots": len(entries),
            },
        )
        return name, cdl.write_collection(entries)
