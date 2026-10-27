"""
Export job use cases: server-made codes and creation (docs/publishing/CONTRACTS.md DOM-PUB-05).
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from django.db import transaction
from django.db.models.functions import Upper
from rest_framework.exceptions import ValidationError

from apps.audit.models import AuditLog
from apps.production.selectors.project import ProjectSelector
from apps.production.selectors.version import VersionSelector
from apps.publishing.models import PublishCounter, PublishItem
from apps.publishing.services import audit

_MAX_TRIES = 1000


def code_in_use(code: str, *, exclude_pk: Any = None) -> bool:
    """Whether a job (soft-deleted ones included) already has this code, in any case."""
    rows = PublishItem.all_objects.annotate(ucode=Upper("code")).filter(ucode=code.upper())
    if exclude_pk is not None:
        rows = rows.exclude(pk=exclude_pk)
    return rows.exists()


@transaction.atomic
def allocate_code(project: Any) -> str:
    """
    The next ``PUB-<project code>-<number>`` for a project.

    Takes a lock on the project's own counter row, so two requests never get the same number
    and Production's project row is never locked. A number whose code is already taken (a hand-typed
    code of the same shape) is skipped.
    """
    PublishCounter.objects.get_or_create(project_id=project.pk)
    counter = PublishCounter.objects.select_for_update().get(pk=project.pk)
    for _ in range(_MAX_TRIES):
        counter.last_number += 1
        code = f"PUB-{project.code.upper()}-{counter.last_number:04d}"
        if not code_in_use(code):
            counter.save(update_fields=["last_number"])
            return code
    raise RuntimeError("No free publish code could be allocated.")  # pragma: no cover


def _copy_entity_from_version(version: Any, data: dict[str, Any]) -> dict[str, Any]:
    if version.entity_type not in {PublishItem.ENTITY_SHOT, PublishItem.ENTITY_ASSET}:
        return {}
    copied = {
        "entity_type": version.entity_type,
        "entity_id": version.entity_id,
        "entity_code": version.entity_code,
        "entity_name": version.entity_name,
    }
    disagree = {
        name: ["Does not match the version's shot or asset."]
        for name, value in copied.items()
        if data.get(name) not in (None, "", value)
    }
    if disagree:
        raise ValidationError(disagree)
    return copied


@transaction.atomic
def create_job(*, actor: Any, data: dict[str, Any]) -> PublishItem:
    """
    Create an export job.

    ``project_id`` (a UUID or code) must name an existing project; ``version_id`` may name the
    version the job produced, which supplies the project and the shot or asset. A blank ``code``
    is numbered by the server (needs a project); a code that is sent must be unused in any case.
    """
    data = dict(data)
    project = None
    if data.get("project_id") not in (None, ""):
        project = ProjectSelector.resolve_by_lookup(data["project_id"])
        if project is None:
            raise ValidationError({"project_id": ["Unknown project."]})

    version = None
    if data.get("version_id") not in (None, ""):
        try:
            version = VersionSelector.resolve(UUID(str(data["version_id"])))
        except ValueError:
            version = None
        if version is None or (
            project is not None and version.project_id != project.pk  # pyright: ignore[reportAttributeAccessIssue]
        ):
            raise ValidationError({"version_id": ["Unknown version."]})
        project = project or version.project
        data.update(_copy_entity_from_version(version, data))

    missing = [
        name
        for name in ("entity_type", "entity_id", "entity_code", "entity_name")
        if not data.get(name)
    ]
    if missing:
        raise ValidationError(
            {name: ["Required unless the version names a shot or asset."] for name in missing}
        )

    code = str(data.get("code") or "").strip()
    if code:
        if code_in_use(code):
            raise ValidationError({"code": ["This code is already used."]})
    elif project is None:
        raise ValidationError({"code": ["Send a code, or a project so the server can number it."]})
    else:
        code = allocate_code(project)

    job = PublishItem.objects.create(
        name=data["name"],
        code=code,
        project=project,
        version=version,
        entity_type=data["entity_type"],
        entity_id=data["entity_id"],
        entity_code=data["entity_code"],
        entity_name=data["entity_name"],
        dcc_tool=data["dcc_tool"],
        dcc_version=data.get("dcc_version", ""),
        source_file=data.get("source_file", ""),
        source_version=data.get("source_version", ""),
        export_path=data.get("export_path", ""),
        export_format=data.get("export_format", ""),
        created_by=actor if getattr(actor, "is_authenticated", False) else None,
    )
    audit.record(
        actor=actor,
        action=AuditLog.ACTION_CREATE,
        target_id=job.pk,
        target_name=job.name,
        description=f"Publish job {job.code} created",
        metadata={"project_id": str(project.pk) if project else None},
    )
    return job


def next_republish_code(original: PublishItem) -> str:
    """A fresh code for a republished job: numbered by project, or derived for a job with no project."""
    if original.project_id:  # pyright: ignore[reportAttributeAccessIssue]
        return allocate_code(original.project)
    number = original.retry_count + 2
    while True:
        code = f"{original.code}_v{number}"[:50]
        if not code_in_use(code):
            return code
        number += 1
