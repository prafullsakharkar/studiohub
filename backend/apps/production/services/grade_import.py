"""
Shot grades imported from the client's CDL files (review-pipeline RP-20, C-RP-54; Q-RP-93).

``POST projects/{id}/grades/import/`` reads one ``.cc``, ``.ccc`` or ``.cdl`` file. Each correction's
``id`` is matched to a shot of the project, ignoring case: the shot's code itself, or the code with
the project's code and ``_`` before it or taken off it (``SH010`` and ``PRJ_SH010``). An exact code
wins over one read through the project's code, and an id two shots would both answer is unmatched.

Only the shots the caller may update are matched: the narrowing of the single shot routes (CR-46),
so a shot the caller cannot see is ``unmatched``, as a bulk update answers ``not_found``. A dry run
(the default) writes nothing; otherwise every matched shot is written in one transaction, or none.
"""

from __future__ import annotations

from pathlib import PurePath
from typing import Any

from django.db import transaction
from django.db.models import QuerySet
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.audit.models import AuditLog
from apps.production.models import Shot
from apps.production.transcode import cdl

#: the largest file read
MAX_BYTES = 1024 * 1024


def _file_name(upload: Any) -> str:
    """The upload's own name, never a client path."""
    return PurePath(str(getattr(upload, "name", "") or "").replace("\\", "/")).name[:200]


def _read(upload: Any) -> tuple[str, bytes]:
    name = _file_name(upload)
    if not name.lower().endswith(cdl.EXTENSIONS):
        raise ValidationError({"file": ["Choose a .cc, .ccc or .cdl file."]})
    if (getattr(upload, "size", 0) or 0) > MAX_BYTES:
        raise ValidationError({"file": ["The file is larger than 1 MiB."]})
    data = upload.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise ValidationError({"file": ["The file is larger than 1 MiB."]})
    return name, data


def _lookup(project: Any, shots: list[Shot]) -> dict[str, Shot | None]:
    """Each key an id may be, upper-cased, and its shot; ``None`` where two shots would answer."""
    prefix = f"{(project.code or '').upper()}_"
    exact = {shot.code.upper(): shot for shot in shots}
    derived: dict[str, Shot | None] = {}
    for shot in shots:
        code = shot.code.upper()
        keys = [prefix + code]
        if code.startswith(prefix) and len(code) > len(prefix):
            keys.append(code[len(prefix) :])
        for key in keys:
            if key in exact:
                continue
            derived[key] = None if key in derived and derived[key] is not shot else shot
    return {**derived, **exact}


def _shot_ref(shot: Shot) -> dict[str, Any]:
    return {"id": shot.pk, "code": shot.code}


class GradeImportService:
    @classmethod
    def import_file(
        cls, *, actor: Any, project: Any, upload: Any, dry_run: bool, scope: QuerySet[Shot]
    ) -> dict[str, Any]:
        """The import's answer (C-RP-54); ``scope`` is the project's shots the caller may update."""
        name, data = _read(upload)
        try:
            corrections = cdl.parse(data)
        except cdl.CdlError as error:
            raise ValidationError({"file": [str(error)]}) from error

        with transaction.atomic():
            shots = list(scope.filter(project=project))
            if not dry_run:
                # The rows written below, locked so the answer is what was written.
                ids = [shot.pk for shot in shots]
                shots = list(Shot.objects.select_for_update().filter(pk__in=ids).order_by("pk"))
            lookup = _lookup(project, shots)
            answer = cls._match(corrections, lookup)
            answer.update({"dry_run": dry_run, "file_name": name, "corrections": len(corrections)})
            answer["applied"] = 0 if dry_run else cls._apply(actor, project, name, answer)
        return answer

    @staticmethod
    def _match(corrections: list[cdl.Correction], lookup: dict[str, Shot | None]) -> dict[str, Any]:
        matched: list[dict[str, Any]] = []
        unchanged: list[dict[str, Any]] = []
        unmatched: list[str] = []
        invalid: list[dict[str, str]] = []
        taken: set[Any] = set()
        for correction in corrections:
            if not correction.valid:
                invalid.append(
                    {"id": correction.id, "field": correction.field, "message": correction.message}
                )
                continue
            shot = lookup.get(correction.id.upper())
            if shot is None:
                unmatched.append(correction.id)
                continue
            if shot.pk in taken:
                invalid.append(
                    {
                        "id": correction.id,
                        "field": "id",
                        "message": f"Another correction in the file is for shot {shot.code}.",
                    }
                )
                continue
            taken.add(shot.pk)
            row = {"id": correction.id, "shot": _shot_ref(shot)}
            if shot.grade == correction.grade:
                unchanged.append(row)
            else:
                matched.append({**row, "old": shot.grade, "new": correction.grade, "_shot": shot})
        return {
            "matched": matched,
            "unchanged": unchanged,
            "unmatched": unmatched,
            "invalid": invalid,
        }

    @staticmethod
    def _apply(actor: Any, project: Any, name: str, answer: dict[str, Any]) -> int:
        now = timezone.now()
        for row in answer["matched"]:
            shot: Shot = row["_shot"]
            shot.grade = row["new"]
            shot.grade_source = f"{name} ({row['id']})"[:255]
            shot.grade_updated_at = now
            shot.save(update_fields=["grade", "grade_source", "grade_updated_at", "updated_at"])
        if answer["matched"]:
            AuditLog.objects.create(
                action=AuditLog.ACTION_UPDATE,
                target_type=AuditLog.TARGET_PROJECT,
                target_id=str(project.pk),
                target_name=str(project.code)[:255],
                project_id=project.pk,
                description=f"Grades of {len(answer['matched'])} shots imported from {name}.",
                actor_id=getattr(actor, "pk", None),
                metadata={
                    "operation": "shot_grades_imported",
                    "file_name": name,
                    "shots": [str(row["_shot"].pk) for row in answer["matched"]],
                },
            )
        return len(answer["matched"])
