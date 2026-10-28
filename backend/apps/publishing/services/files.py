"""
The published file registry: registration, lifecycle, checksum verification
(docs/publishing/CONTRACTS.md DOM-PUB-02 to DOM-PUB-04).

Every public method is one ``transaction.atomic()``. A registered file is never edited: the only
writes after registration are the lifecycle fields, all made here.
"""

from __future__ import annotations

import re
from typing import Any
from uuid import UUID

from django.db import IntegrityError, transaction
from django.db.models.functions import Upper
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.audit.models import AuditLog
from apps.core.api.exceptions.api import NotFoundException
from apps.core.events import default_event_bus
from apps.masterdata.selectors.catalog import MasterFileTypeSelector
from apps.production.permissions.checks import has_explicit_permission_code, has_permission_code
from apps.production.selectors.version import VersionSelector
from apps.publishing.constants import workflow
from apps.publishing.domain.paths import PathRuleError, is_sequence_pattern, normalize_relative_path
from apps.publishing.events import PublishedFileRevoked
from apps.publishing.exceptions import (
    InvalidTransition,
    PathAlreadyRegistered,
    TransitionNotPermitted,
)
from apps.publishing.models import PublishedFile, PublishedFileEvent, PublishItem, StorageRoot
from apps.publishing.services import audit

BULK_LIMIT = 100
_SHA256 = re.compile(r"^[0-9a-fA-F]{64}$")
_ROLES = {choice.value for choice in PublishedFile.Role}
_REGISTRATION_KEYS = frozenset(
    {
        "version_id",
        "storage_root",
        "relative_path",
        "role",
        "file_type",
        "size_bytes",
        "sha256",
        "frame_start",
        "frame_end",
        "export_job_id",
    }
)


class UnknownVersion(ValidationError):
    """The version is unknown, deleted, out of the caller's reach, or not published (one message for all)."""

    default_code = "unknown_version"

    def __init__(self) -> None:
        super().__init__({"version_id": ["Unknown or unpublished version."]})


def _actor_or_none(actor: Any):
    return actor if getattr(actor, "is_authenticated", False) else None


def _clean_registration(version_project_id: Any, data: dict[str, Any]) -> dict[str, Any]:
    """Validate and resolve one registration body. Raises ``ValidationError`` keyed by field."""
    errors: dict[str, list[str]] = {
        name: ["Unknown field."] for name in sorted(set(data) - _REGISTRATION_KEYS)
    }
    cleaned: dict[str, Any] = {}

    root_value = str(data.get("storage_root") or "").strip()
    root = None
    if root_value:
        rows = StorageRoot.objects.filter(is_active=True)
        try:
            root = rows.filter(pk=UUID(root_value)).first()
        except ValueError:
            root = rows.annotate(u=Upper("code")).filter(u=root_value.upper()).first()
    if root is None:
        errors["storage_root"] = ["Unknown or inactive storage root."]
    cleaned["storage_root"] = root

    try:
        cleaned["relative_path"] = normalize_relative_path(data.get("relative_path"))  # pyright: ignore[reportArgumentType]
    except PathRuleError as error:
        errors["relative_path"] = [str(error)]

    role = data.get("role") or PublishedFile.Role.MAIN
    if role not in _ROLES:
        errors["role"] = [f"One of: {', '.join(sorted(_ROLES))}."]
    cleaned["role"] = role

    file_type = None
    if data.get("file_type"):
        file_type = MasterFileTypeSelector.resolve_active(data["file_type"])
        if file_type is None:
            errors["file_type"] = ["Unknown or inactive file type."]
    cleaned["file_type"] = file_type

    size = data.get("size_bytes")
    if isinstance(size, bool) or not isinstance(size, int) or size < 0:
        errors["size_bytes"] = ["A whole number of bytes, zero or more."]
    cleaned["size_bytes"] = size

    sha = str(data.get("sha256") or "")
    if not _SHA256.match(sha):
        errors["sha256"] = ["64 hexadecimal characters."]
    cleaned["sha256"] = sha.lower()

    start, end = data.get("frame_start"), data.get("frame_end")
    frames_ok = True
    for name, value in (("frame_start", start), ("frame_end", end)):
        if value is not None and (isinstance(value, bool) or not isinstance(value, int)):
            errors[name] = ["A whole number."]
            frames_ok = False
    if frames_ok:
        if (start is None) != (end is None):
            errors["frame_end" if end is None else "frame_start"] = [
                "Give both frame_start and frame_end, or neither."
            ]
        elif start is not None and end is not None and end < start:
            errors["frame_end"] = ["Cannot be before frame_start."]
        elif "relative_path" in cleaned:
            has_pattern = is_sequence_pattern(cleaned["relative_path"])
            if start is not None and not has_pattern:
                errors["relative_path"] = [
                    "A frame range needs a sequence pattern in the file name (%04d or ####)."
                ]
            elif start is None and has_pattern:
                errors["frame_start"] = ["A sequence pattern needs frame_start and frame_end."]
    cleaned["frame_start"], cleaned["frame_end"] = start, end

    job = None
    if data.get("export_job_id"):
        try:
            job = PublishItem.objects.filter(
                pk=UUID(str(data["export_job_id"])), project_id=version_project_id
            ).first()
        except ValueError:
            job = None
        if job is None:
            errors["export_job_id"] = ["Unknown export job."]
    cleaned["export_job"] = job

    if errors:
        raise ValidationError(errors)
    return cleaned


def _same_content(existing: PublishedFile, version_id: Any, cleaned: dict[str, Any]) -> bool:
    return (
        existing.version_id == version_id  # pyright: ignore[reportAttributeAccessIssue]
        and existing.status == PublishedFile.Status.REGISTERED
        and existing.size_bytes == cleaned["size_bytes"]
        and existing.sha256 == cleaned["sha256"]
        and existing.role == cleaned["role"]
        and existing.frame_start == cleaned["frame_start"]
        and existing.frame_end == cleaned["frame_end"]
    )


class PublishedFileService:
    @classmethod
    @transaction.atomic
    def register(
        cls, *, actor: Any, request: Any, version_id: Any, data: dict[str, Any]
    ) -> tuple[PublishedFile, bool]:
        """
        Register one file of a published version. Returns ``(file, created)``.

        The same path registered again with identical content is the same file (``created`` is
        False: a pipeline tool may retry). Any difference is ``PathAlreadyRegistered`` (409).
        """
        version = VersionSelector.resolve_visible(request, version_id)
        if version is None or not version.is_published:
            raise UnknownVersion()
        cleaned = _clean_registration(version.project_id, data)  # pyright: ignore[reportAttributeAccessIssue]

        existing = (
            PublishedFile.all_objects.select_for_update()
            .filter(storage_root=cleaned["storage_root"], relative_path=cleaned["relative_path"])
            .first()
        )
        if existing is not None:
            return cls._same_or_conflict(existing, version.pk, cleaned), False

        try:
            with transaction.atomic():
                file = PublishedFile.objects.create(
                    version=version,
                    project_id=version.project_id,  # pyright: ignore[reportAttributeAccessIssue]
                    created_by=_actor_or_none(actor),
                    **cleaned,
                )
        except IntegrityError:
            # Another request registered the same path between the lookup and the insert.
            existing = PublishedFile.all_objects.get(
                storage_root=cleaned["storage_root"], relative_path=cleaned["relative_path"]
            )
            return cls._same_or_conflict(existing, version.pk, cleaned), False

        PublishedFileEvent.objects.create(
            file=file,
            kind=PublishedFileEvent.Kind.REGISTERED,
            to_status=file.status,
            actor=_actor_or_none(actor),
        )
        audit.record(
            actor=actor,
            action=AuditLog.ACTION_CREATE,
            target_id=file.pk,
            target_name=f"{file.storage_root.code}:{file.role}",
            description=f"File registered for version {version.code}",
            metadata={
                "version_id": str(version.pk),
                "project_id": str(version.project_id),  # pyright: ignore[reportAttributeAccessIssue]
            },
        )
        return file, True

    @staticmethod
    def _same_or_conflict(
        existing: PublishedFile, version_id: Any, cleaned: dict[str, Any]
    ) -> PublishedFile:
        if _same_content(existing, version_id, cleaned):
            return existing
        raise PathAlreadyRegistered()

    @classmethod
    def register_many(
        cls, *, actor: Any, request: Any, items: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        """
        Register up to ``BULK_LIMIT`` files, each in its own transaction (partial success).

        Each item is ``{"version_id": ..., <registration body>}``. Returns one result per item:
        ``index``, ``id`` (the file, or None), ``ok``, ``error`` (None, ``invalid``,
        ``unknown_version``, ``path_already_registered``) and, for ``invalid``, ``fields``.
        """
        if not 1 <= len(items) <= BULK_LIMIT:
            raise ValidationError({"items": [f"Send between 1 and {BULK_LIMIT} items."]})
        results: list[dict[str, Any]] = []
        for index, item in enumerate(items):
            result: dict[str, Any] = {"index": index, "id": None, "ok": False, "error": None}
            try:
                if not isinstance(item, dict):
                    raise ValidationError({"item": ["An object is required."]})
                file, _created = cls.register(
                    actor=actor,
                    request=request,
                    version_id=item.get("version_id"),
                    data=item,
                )
                result.update(id=str(file.pk), ok=True)
            except UnknownVersion:
                result["error"] = "unknown_version"
            except PathAlreadyRegistered:
                result["error"] = "path_already_registered"
            except ValidationError as error:
                result["error"] = "invalid"
                result["fields"] = error.detail
            results.append(result)
        return results

    # -- lifecycle ------------------------------------------------------------------------

    @classmethod
    @transaction.atomic
    def change_status(
        cls,
        *,
        actor: Any,
        request: Any,
        file: PublishedFile,
        target: str,
        reason: str = "",
        override_reason: str | None = None,
    ) -> PublishedFile:
        """The only writer of ``PublishedFile.status``; follows ``constants.workflow``."""
        locked = (
            PublishedFile.all_objects.select_for_update().select_related("project").get(pk=file.pk)
        )
        if not VersionSelector.user_has_project_access(request=request, project=locked.project):
            # The caller cannot reach the file's project: answer as the viewset does for an unknown id.
            raise NotFoundException()
        source = locked.status
        if target not in workflow.FILE_STATUSES or not workflow.can_move(source, target):
            # Includes the loser of a race: the winner already moved it.
            raise InvalidTransition(
                {"code": "invalid_transition", "from": source, "to": target}  # pyright: ignore[reportArgumentType]
            )

        override_kind = ""
        if workflow.needs_override(source, target):
            if not (override_reason or "").strip():
                raise ValidationError({"override_reason": ["Required to leave this status."]})
            if not has_explicit_permission_code(
                request, workflow.required_permission(source, target)
            ):
                raise TransitionNotPermitted()
            override_kind = "status"
        elif not has_permission_code(request, workflow.required_permission(source, target)):
            raise TransitionNotPermitted()

        if target == workflow.REVOKED and not reason.strip():
            raise ValidationError({"reason": ["A reason is required to revoke a file."]})

        now = timezone.now()
        locked.status = target
        locked.status_changed_at = now
        locked.status_changed_by = _actor_or_none(actor)
        locked.updated_by = _actor_or_none(actor)
        fields = ["status", "status_changed_at", "status_changed_by", "updated_by", "updated_at"]
        if target == workflow.REVOKED:
            locked.revoke_reason = reason.strip()
            fields.append("revoke_reason")
        locked.save(update_fields=fields)

        PublishedFileEvent.objects.create(
            file=locked,
            kind=PublishedFileEvent.Kind.STATUS,
            from_status=source,
            to_status=target,
            actor=_actor_or_none(actor),
            reason=(override_reason or reason or "").strip(),
            override_kind=override_kind,
            at=now,
        )
        audit.record(
            actor=actor,
            action=AuditLog.ACTION_UPDATE,
            target_id=locked.pk,
            target_name=f"{locked.storage_root_id}:{locked.role}",  # pyright: ignore[reportAttributeAccessIssue]
            description=f"File {source} -> {target}" + (" (override)" if override_kind else ""),
            project_id=locked.project_id,  # pyright: ignore[reportAttributeAccessIssue]
            metadata={
                "from": source,
                "to": target,
                "override": bool(override_kind),
                "version_id": str(locked.version_id),  # pyright: ignore[reportAttributeAccessIssue]
            },
        )
        if target == workflow.REVOKED:
            default_event_bus.publish(
                PublishedFileRevoked(
                    file_id=str(locked.pk),
                    version_id=str(locked.version_id),  # pyright: ignore[reportAttributeAccessIssue]
                    project_id=str(locked.project_id),  # pyright: ignore[reportAttributeAccessIssue]
                    actor_id=str(actor.pk) if getattr(actor, "pk", None) else None,
                    reason_present=True,
                )
            )
        return locked

    @classmethod
    def deprecate(
        cls,
        *,
        actor: Any,
        request: Any,
        file: PublishedFile,
        note: str = "",
        override_reason: str | None = None,
    ) -> PublishedFile:
        return cls.change_status(
            actor=actor,
            request=request,
            file=file,
            target=workflow.DEPRECATED,
            reason=note,
            override_reason=override_reason,
        )

    @classmethod
    def restore(
        cls, *, actor: Any, request: Any, file: PublishedFile, override_reason: str | None = None
    ) -> PublishedFile:
        return cls.change_status(
            actor=actor,
            request=request,
            file=file,
            target=workflow.REGISTERED,
            override_reason=override_reason,
        )

    @classmethod
    def revoke(cls, *, actor: Any, request: Any, file: PublishedFile, reason: str) -> PublishedFile:
        return cls.change_status(
            actor=actor, request=request, file=file, target=workflow.REVOKED, reason=reason
        )

    # -- verification (called by the Celery task only) ---------------------------------------

    @classmethod
    @transaction.atomic
    def record_verification(cls, *, file_id: Any, state: str) -> None:
        """Store the result of reading the file: verified, mismatch or missing. Never touches ``sha256``."""
        if state not in {
            PublishedFile.ChecksumState.VERIFIED,
            PublishedFile.ChecksumState.MISMATCH,
            PublishedFile.ChecksumState.MISSING,
        }:
            raise ValueError(f"Unknown verification state: {state}")
        locked = PublishedFile.all_objects.select_for_update().filter(pk=file_id).first()
        if locked is None:
            return
        now = timezone.now()
        locked.checksum_state = state
        locked.checksum_checked_at = now
        locked.save(update_fields=["checksum_state", "checksum_checked_at", "updated_at"])
        PublishedFileEvent.objects.create(
            file=locked, kind=PublishedFileEvent.Kind.VERIFICATION, detail=state, at=now
        )
