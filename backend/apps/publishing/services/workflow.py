"""
Export job workflow (docs/publishing/CONTRACTS.md DOM-PUB-05, decisions Q14 and Q27).

``JobService`` is the only writer of ``PublishItem.status``. Every method is one
``transaction.atomic()``, locks the job row and reads the status again inside the lock, so of two
requests that race the loser sees the winner's status and gets a 409 ``invalid_transition``.
The map is ``constants.workflow.JOB_TRANSITIONS``.

Authorization by project membership is Phase 5; the viewset gates these calls with
``publishing.update`` for now.
"""

from __future__ import annotations

from typing import Any

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.audit.models import AuditLog
from apps.core.api.exceptions.api import NotFoundException
from apps.production.permissions.checks import has_explicit_permission_code
from apps.publishing.constants import workflow as wf
from apps.publishing.constants.permissions import PublishPermissions
from apps.publishing.exceptions import InvalidTransition, JobNotEditable, TransitionNotPermitted
from apps.publishing.models import PublishItem
from apps.publishing.services import audit, validation

#: Details an export job lets people edit, and only while it is Pending or Failed.
EDITABLE_FIELDS = (
    "name",
    "dcc_tool",
    "dcc_version",
    "source_file",
    "source_version",
    "export_path",
    "export_format",
    "export_options",
    "validation_rules",
)


def _actor_or_none(actor: Any):
    return actor if getattr(actor, "is_authenticated", False) else None


class JobService:
    @staticmethod
    def _lock(job: PublishItem | Any) -> PublishItem:
        pk = getattr(job, "pk", job)
        try:
            return PublishItem.objects.select_for_update().get(pk=pk)
        except PublishItem.DoesNotExist as error:
            raise NotFoundException() from error

    @staticmethod
    def _refuse(source: str, target: str) -> InvalidTransition:
        # Also the loser of a race: the winner already moved the job.
        return InvalidTransition({"code": "invalid_transition", "from": source, "to": target})  # pyright: ignore[reportArgumentType]

    @classmethod
    def _step(
        cls,
        job: PublishItem,
        target: str,
        *,
        extra: dict[str, Any] | None = None,
        request: Any = None,
        override_reason: str | None = None,
    ) -> str:
        """Move a locked job along the map and save it. Returns the override kind ('' for a working move)."""
        source = job.status
        override_kind = ""
        if wf.job_move_needs_override(source, target):
            if not (override_reason or "").strip():
                raise ValidationError({"override_reason": ["Required to leave this status."]})
            if request is None or not has_explicit_permission_code(
                request, PublishPermissions.STATUS_OVERRIDE
            ):
                raise TransitionNotPermitted()
            override_kind = "status"
        elif target not in wf.JOB_STATUSES or not wf.can_move_job(source, target):
            raise cls._refuse(source, target)

        job.status = target
        fields = ["status", "updated_at"]
        for name, value in (extra or {}).items():
            setattr(job, name, value)
            fields.append(name)
        job.save(update_fields=fields)
        return override_kind

    @classmethod
    def _audit(
        cls, actor: Any, job: PublishItem, action: str, description: str, **metadata: Any
    ) -> None:
        audit.record(
            actor=actor,
            action=action,
            target_id=job.pk,
            target_name=job.name,
            description=description,
            project_id=job.project_id,  # pyright: ignore[reportAttributeAccessIssue]
            metadata=metadata,
        )

    # -- the public moves ---------------------------------------------------------------

    @classmethod
    @transaction.atomic
    def move(
        cls,
        *,
        actor: Any,
        job: Any,
        target: str,
        request: Any = None,
        override_reason: str | None = None,
    ) -> PublishItem:
        """Move a job along the map. Leaving Exported or Cancelled needs the override and a reason."""
        locked = cls._lock(job)
        source = locked.status
        kind = cls._step(locked, target, request=request, override_reason=override_reason)
        cls._audit(
            actor,
            locked,
            AuditLog.ACTION_UPDATE,
            f"Publish {locked.code}: {source} -> {target}" + (" (override)" if kind else ""),
            **{"from": source, "to": target, "override": bool(kind)},
        )
        return locked

    @classmethod
    @transaction.atomic
    def validate(cls, *, actor: Any, job: Any) -> tuple[PublishItem, dict[str, Any]]:
        """Run the active rules. A Pending job, or a Validated one being re-validated, ends Validated or Failed."""
        locked = cls._lock(job)
        source = locked.status
        if source not in {wf.JOB_PENDING, wf.JOB_VALIDATED}:
            raise cls._refuse(source, wf.JOB_VALIDATING)
        if source == wf.JOB_VALIDATED:
            cls._step(locked, wf.JOB_PENDING)  # re-validate
        cls._step(locked, wf.JOB_VALIDATING)

        results = validation.evaluate(locked)
        summary = validation.summarize(results)
        summary["checked_at"] = timezone.now().isoformat()
        passed = summary["passed"]
        cls._step(
            locked,
            wf.JOB_VALIDATED if passed else wf.JOB_FAILED,
            extra={
                "validation_results": summary,
                "error_message": "" if passed else "Validation failed",
            },
        )
        cls._audit(
            actor,
            locked,
            AuditLog.ACTION_UPDATE,
            f"Publish {locked.code} validated: {'passed' if passed else 'failed'}",
            **{"from": source, "to": locked.status, **summary["counts"]},
        )
        return locked, summary

    @classmethod
    @transaction.atomic
    def retry(cls, *, actor: Any, job: Any) -> PublishItem:
        """Send a Failed job back to Pending."""
        locked = cls._lock(job)
        if locked.status != wf.JOB_FAILED:
            raise cls._refuse(locked.status, wf.JOB_PENDING)
        cls._step(
            locked,
            wf.JOB_PENDING,
            extra={"error_message": "", "retry_count": locked.retry_count + 1},
        )
        cls._audit(
            actor,
            locked,
            AuditLog.ACTION_UPDATE,
            f"Publish {locked.code} retried (attempt {locked.retry_count + 1})",
            **{"from": wf.JOB_FAILED, "to": wf.JOB_PENDING},
        )
        return locked

    @classmethod
    @transaction.atomic
    def start_export(cls, *, actor: Any, job: Any) -> PublishItem:
        """A pipeline tool reports that the export began: Validated to Exporting."""
        locked = cls._lock(job)
        source = locked.status
        cls._step(locked, wf.JOB_EXPORTING)
        cls._audit(
            actor,
            locked,
            AuditLog.ACTION_UPDATE,
            f"Publish {locked.code} export started",
            **{"from": source, "to": wf.JOB_EXPORTING},
        )
        return locked

    @classmethod
    @transaction.atomic
    def complete_export(cls, *, actor: Any, job: Any) -> PublishItem:
        """The export finished: Exporting to Exported (final). No file is required; validation reports a missing one."""
        locked = cls._lock(job)
        source = locked.status
        cls._step(locked, wf.JOB_EXPORTED)
        cls._audit(
            actor,
            locked,
            AuditLog.ACTION_UPDATE,
            f"Publish {locked.code} export completed",
            **{"from": source, "to": wf.JOB_EXPORTED},
        )
        return locked

    @classmethod
    @transaction.atomic
    def fail(cls, *, actor: Any, job: Any, reason: str) -> PublishItem:
        """The export failed: Exporting to Failed, with the reason the tool gives (stored as the error message)."""
        reason = (reason or "").strip()
        if not reason:
            raise ValidationError({"reason": ["A reason is required."]})
        locked = cls._lock(job)
        source = locked.status
        if source != wf.JOB_EXPORTING:
            # The map also allows Validating to Failed, but that is a validation result, not an export report.
            raise cls._refuse(source, wf.JOB_FAILED)
        cls._step(locked, wf.JOB_FAILED, extra={"error_message": reason})
        cls._audit(
            actor,
            locked,
            AuditLog.ACTION_UPDATE,
            f"Publish {locked.code} export failed",
            **{"from": source, "to": wf.JOB_FAILED, "reason_given": True},
        )
        return locked

    @classmethod
    @transaction.atomic
    def cancel(cls, *, actor: Any, job: Any, reason: str = "") -> PublishItem:
        """Cancel a job that has not finished (the ``unpublish`` action). Exported and Cancelled jobs are final."""
        locked = cls._lock(job)
        source = locked.status
        cls._step(locked, wf.JOB_CANCELLED, extra={"cancel_reason": (reason or "").strip()})
        cls._audit(
            actor,
            locked,
            AuditLog.ACTION_UPDATE,
            f"Publish {locked.code} cancelled",
            **{
                "from": source,
                "to": wf.JOB_CANCELLED,
                "reason_given": bool((reason or "").strip()),
            },
        )
        return locked

    @classmethod
    @transaction.atomic
    def republish(cls, *, actor: Any, job: Any, comment: str = "") -> PublishItem:
        """A new Pending job from an existing one, in any status; the old job is not changed."""
        from apps.publishing.services.jobs import next_republish_code

        original = cls._lock(job)
        new = PublishItem.objects.create(
            name=original.name,
            code=next_republish_code(original),
            project=original.project,
            version=original.version,
            republished_from=original,
            entity_type=original.entity_type,
            entity_id=original.entity_id,
            entity_code=original.entity_code,
            entity_name=original.entity_name,
            dcc_tool=original.dcc_tool,
            dcc_version=original.dcc_version,
            source_file=original.source_file,
            source_version=f"{original.source_version}+1" if original.source_version else "v2",
            export_path=original.export_path,
            export_format=original.export_format,
            status=PublishItem.STATUS_PENDING,
            retry_count=original.retry_count + 1,
            created_by=_actor_or_none(actor),
        )
        cls._audit(
            actor,
            new,
            AuditLog.ACTION_CREATE,
            f"New publish iteration created from {original.code}",
            original_publish_id=str(original.pk),
            iteration=new.retry_count + 1,
            comment_given=bool((comment or "").strip()),
        )
        return new

    @classmethod
    @transaction.atomic
    def update(cls, *, actor: Any, job: Any, data: dict[str, Any]) -> PublishItem:
        """Edit a job's details. Only while it is Pending or Failed; the status is never edited here."""
        locked = cls._lock(job)
        if locked.status not in wf.JOB_EDITABLE_STATES:
            raise JobNotEditable()
        changed = []
        for name in EDITABLE_FIELDS:
            if name in data and getattr(locked, name) != data[name]:
                setattr(locked, name, data[name])
                changed.append(name)
        if changed:
            locked.updated_by = _actor_or_none(actor)
            locked.save(update_fields=[*changed, "updated_by", "updated_at"])
            cls._audit(
                actor,
                locked,
                AuditLog.ACTION_UPDATE,
                f"Publish {locked.code} edited: {', '.join(changed)}",
                fields=changed,
            )
        return locked
