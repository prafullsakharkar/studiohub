"""
Delivery use cases (docs/deliveries/CONTRACTS.md DOM-DLV-01 to DOM-DLV-11).

Every public method is one ``transaction.atomic()`` and takes a row lock on the package, so of two
requests that race (two sends, two adds of the same version) the loser sees the winner's result.
The status is written only by ``transitions.move`` (the map is ``constants.workflow``).

Methods that need the caller's permissions take the ``request``: a move is checked against the
code the map names for it, on every path. A call without a request (internal callers, tests) is
trusted. Authorization by project membership is Phase 8.

A QC run that fails keeps its rows: the 409 ``qc_failed`` is raised after the transaction commits.
"""

from __future__ import annotations

from typing import Any

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.audit.models import AuditLog
from apps.core.api.exceptions.api import ConflictException, NotFoundException
from apps.deliveries import passcode
from apps.deliveries.constants import workflow as wf
from apps.deliveries.constants.permissions import DeliveryPermissions
from apps.deliveries.exceptions import (
    DeliveryNotEditable,
    QCFailed,
    SeparationOfDuties,
    TransitionNotPermitted,
    UndeliverableVersion,
)
from apps.deliveries.models import DeliveryPackage, DeliveryStatusChange, DeliveryVersionRef
from apps.deliveries.services import audit, duties, items, manifest, numbering, qc, transitions
from apps.masterdata.selectors.directory import ClientSelector
from apps.production.permissions.checks import has_explicit_permission_code, has_permission_code
from apps.production.selectors.base import ProductionBaseSelector
from apps.production.selectors.project import ProjectSelector

EDITABLE_FIELDS = (
    "name",
    "delivery_method",
    "delivery_destination",
    "expires_at",
    "notes",
    "client_notes",
)


class AlreadyRevised(ConflictException):
    """A live revision of this rejected delivery already exists (409)."""

    default_detail = "This delivery has already been revised."
    default_code = "already_revised"


def _actor_or_none(actor: Any):
    return actor if getattr(actor, "is_authenticated", False) else None


def is_editable(package: DeliveryPackage) -> bool:
    """Items and details can change only before the delivery is sent."""
    return package.status in wf.WORKING_STATES and package.sent_at is None


class DeliveryService:
    @staticmethod
    def _lock(package: Any) -> DeliveryPackage:
        pk = getattr(package, "pk", package)
        try:
            return DeliveryPackage.objects.select_for_update().get(pk=pk)
        except DeliveryPackage.DoesNotExist as error:
            raise NotFoundException() from error

    @classmethod
    def _require_editable(cls, package: DeliveryPackage) -> None:
        if not is_editable(package):
            raise DeliveryNotEditable()

    @staticmethod
    def _qc_failed(result: dict[str, Any]) -> QCFailed:
        return QCFailed({"code": "qc_failed", "checks": qc.failures(result)})  # pyright: ignore[reportArgumentType]

    # -- create / edit --------------------------------------------------------------------

    @classmethod
    @transaction.atomic
    def create(cls, *, actor: Any, data: dict[str, Any]) -> DeliveryPackage:
        """
        Create a delivery. A blank code is numbered by the server from the project; a code that is
        sent must be unused in any case. An unknown project or client is a 400. A passcode is
        stored encrypted (503 when no key is configured).
        """
        data = dict(data)
        project = None
        if data.get("project_id") not in (None, ""):
            project = ProjectSelector.resolve_by_lookup(data["project_id"])
            if project is None:
                raise ValidationError({"project_id": ["Unknown project."]})
        client = None
        if data.get("client_id"):
            client = ClientSelector.get_queryset().filter(pk=data["client_id"]).first()
            if client is None:
                raise ValidationError({"client_id": ["Unknown client."]})

        code = str(data.get("code") or "").strip()
        if code:
            if numbering.code_in_use(code):
                raise ValidationError({"code": ["A delivery with this code already exists."]})
        elif project is None:
            raise ValidationError(
                {"code": ["Send a code, or a project so the server can number it."]}
            )
        else:
            code = numbering.allocate_code(project)

        package = DeliveryPackage.objects.create(
            name=data["name"],
            code=code,
            project=project,
            client=client,
            delivery_method=data.get("delivery_method") or DeliveryPackage.METHOD_S3,
            delivery_destination=data.get("delivery_destination", ""),
            passcode=passcode.encrypt(data.get("passcode") or ""),
            expires_at=data.get("expires_at"),
            notes=data.get("notes", ""),
            client_notes=data.get("client_notes", ""),
            created_by=_actor_or_none(actor),
        )
        transitions.record_creation(package, actor)
        audit.record(
            actor=actor,
            action=AuditLog.ACTION_CREATE,
            package=package,
            description=f"Delivery {package.code} created",
            metadata={"project_id": str(project.pk) if project else None},
        )
        return package

    @classmethod
    @transaction.atomic
    def update(cls, *, actor: Any, package: Any, data: dict[str, Any]) -> DeliveryPackage:
        """Edit a delivery's details; only before it is sent. The status is never edited here."""
        locked = cls._lock(package)
        cls._require_editable(locked)
        changed = []
        for name in EDITABLE_FIELDS:
            if name in data and getattr(locked, name) != data[name]:
                setattr(locked, name, data[name])
                changed.append(name)
        if "passcode" in data:
            new_value = data["passcode"] or ""
            # Ciphertext differs on every write, so compare on presence, not value.
            if new_value or locked.passcode:
                locked.passcode = passcode.encrypt(new_value)
                changed.append("passcode")
        if changed:
            locked.updated_by = _actor_or_none(actor)
            locked.save(update_fields=[*changed, "updated_by", "updated_at"])
            audit.record(
                actor=actor,
                action=AuditLog.ACTION_UPDATE,
                package=locked,
                description=f"Delivery {locked.code} edited: {', '.join(changed)}",
                metadata={"fields": changed},
            )
        return locked

    # -- the passcode ----------------------------------------------------------------------

    @classmethod
    @transaction.atomic
    def read_passcode(cls, *, actor: Any, package: Any, request: Any) -> str:
        """
        The passcode in plain text, for a holder of ``delivery.view_secret`` who may see the
        delivery's project. Every read is audited (without the value).
        """
        locked = cls._lock(package)
        if request is None or not has_permission_code(request, DeliveryPermissions.VIEW_SECRET):
            raise TransitionNotPermitted()
        if not ProductionBaseSelector.user_has_project_access(
            request=request, project=locked.project
        ):
            raise NotFoundException()
        value = passcode.decrypt(locked.passcode)
        audit.record(
            actor=actor,
            action=AuditLog.ACTION_UPDATE,
            package=locked,
            description=f"Delivery {locked.code} passcode viewed",
            metadata={"set": bool(value)},
        )
        return value

    # -- items ----------------------------------------------------------------------------

    @classmethod
    @transaction.atomic
    def add_version(cls, *, actor: Any, package: Any, version_id: Any) -> DeliveryVersionRef:
        """
        Add a published version of the delivery's project. The number, the shot or asset and the
        files all come from the registry; anything the caller sends about them is ignored.
        """
        locked = cls._lock(package)
        cls._require_editable(locked)
        if locked.project_id is None:  # pyright: ignore[reportAttributeAccessIssue]
            raise ValidationError(
                {"project_id": ["Give the delivery a project before adding versions."]}
            )
        version, files = items.check_deliverable(locked.project_id, version_id)  # pyright: ignore[reportAttributeAccessIssue]
        try:
            with transaction.atomic():
                ref = DeliveryVersionRef.objects.create(
                    delivery=locked,
                    version=version,
                    added_by=_actor_or_none(actor),
                    version_number=version.version_number,
                    entity_type=version.entity_type,
                    entity_code=version.entity_code,
                    entity_name=version.entity_name,
                    file_path="",
                )
        except IntegrityError as error:
            raise ValidationError(
                {"version_id": ["This version is already in the delivery."]}
            ) from error
        items.apply_snapshot(ref, version, files)
        locked.qc_run_id = None
        locked.save(update_fields=["qc_run_id", "updated_at"])
        audit.record(
            actor=actor,
            action=AuditLog.ACTION_UPDATE,
            package=locked,
            description=f"Delivery {locked.code}: version {version.code} added",
            metadata={"version_id": str(version.pk), "files": len(files)},
        )
        return ref

    @classmethod
    @transaction.atomic
    def remove_version(cls, *, actor: Any, package: Any, item_key: Any) -> DeliveryPackage:
        """Remove an item (by its uid or the older integer id); only before the delivery is sent."""
        locked = cls._lock(package)
        cls._require_editable(locked)
        ref = items.find_item(locked, item_key)
        if ref is None:
            raise ValidationError({"version_ref_id": ["Unknown item."]})
        ref.files.all().delete()  # pyright: ignore[reportAttributeAccessIssue]
        version_id = str(ref.version_id)  # pyright: ignore[reportAttributeAccessIssue]
        ref.delete()
        locked.qc_run_id = None
        locked.save(update_fields=["qc_run_id", "updated_at"])
        audit.record(
            actor=actor,
            action=AuditLog.ACTION_UPDATE,
            package=locked,
            description=f"Delivery {locked.code}: a version was removed",
            metadata={"version_id": version_id},
        )
        return locked

    # -- QC, prepare, sign-off, send ---------------------------------------------------------

    @classmethod
    @transaction.atomic
    def validate(
        cls, *, actor: Any, package: Any, request: Any = None
    ) -> tuple[DeliveryPackage, dict[str, Any]]:
        """Run QC and record it. A Draft delivery becomes Validating; the other editable ones keep their status."""
        locked = cls._lock(package)
        cls._require_editable(locked)
        result = qc.run(locked, actor)
        if locked.status == wf.DRAFT:
            transitions.move(locked, wf.VALIDATING, actor=actor, request=request)
        audit.record(
            actor=actor,
            action=AuditLog.ACTION_UPDATE,
            package=locked,
            description=f"Delivery {locked.code} validated: {'passed' if result['passed'] else 'failed'}",
            metadata={"run_id": str(result["run_id"]), "passed": result["passed"]},
        )
        return locked, result

    @classmethod
    @transaction.atomic
    def retry(cls, *, actor: Any, package: Any, request: Any = None) -> DeliveryPackage:
        """Run QC again. Only a Validating delivery retries; anything else is a 409."""
        locked = cls._lock(package)
        if locked.status != wf.VALIDATING or locked.sent_at is not None:
            raise transitions.refuse(locked.status, wf.VALIDATING)
        result = qc.run(locked, actor)
        audit.record(
            actor=actor,
            action=AuditLog.ACTION_UPDATE,
            package=locked,
            description=f"Delivery {locked.code} validated again: "
            f"{'passed' if result['passed'] else 'failed'}",
            metadata={"run_id": str(result["run_id"]), "passed": result["passed"]},
        )
        return locked

    @classmethod
    def prepare(
        cls, *, actor: Any, package: Any, request: Any = None
    ) -> tuple[DeliveryPackage, dict[str, Any]]:
        """
        Refresh every item from the registry, run QC and, only if it passes, build the manifest and
        mark the delivery Prepared. A failing QC is a 409 listing the failing checks; the run's rows
        and the refreshed snapshot are kept (the 409 is raised after the transaction commits).
        """
        with transaction.atomic():
            locked = cls._lock(package)
            cls._require_editable(locked)
            items.refresh(locked)
            result = qc.run(locked, actor)
            if result["passed"]:
                manifest_data, checksums = manifest.build(locked)
                locked.manifest_data = manifest_data
                locked.checksums = checksums
                if locked.status == wf.PREPARED:
                    locked.save(update_fields=["manifest_data", "checksums", "updated_at"])
                else:
                    transitions.move(
                        locked,
                        wf.PREPARED,
                        actor=actor,
                        request=request,
                        extra={"manifest_data": manifest_data, "checksums": checksums},
                    )
                audit.record(
                    actor=actor,
                    action=AuditLog.ACTION_EXPORT,
                    package=locked,
                    description=f"Delivery {locked.code} prepared for submission",
                    metadata={
                        "run_id": str(result["run_id"]),
                        "versions": checksums["version_count"],
                    },
                )
        if not result["passed"]:
            raise cls._qc_failed(result)
        return locked, result

    @classmethod
    def sign_off(
        cls,
        *,
        actor: Any,
        package: Any,
        request: Any = None,
        notes: str = "",
        override_reason: str | None = None,
    ) -> DeliveryPackage:
        """
        Internal approval: Prepared to Signed Off (decision Q16). Refused when the caller prepared
        the delivery (403 ``separation_of_duties``) unless they hold ``delivery.sod.override`` and
        give a reason, which is recorded as ``self_approval``. QC runs again; a failing run keeps
        its rows and is a 409.
        """
        if _actor_or_none(actor) is None:
            raise TransitionNotPermitted()
        with transaction.atomic():
            locked = cls._lock(package)
            if locked.status != wf.PREPARED or locked.sent_at is not None:
                raise transitions.refuse(locked.status, wf.SIGNED_OFF)
            kind = ""
            if duties.prepared_by(locked, actor):
                reason = (override_reason or "").strip()
                if not (
                    reason
                    and request is not None
                    and has_explicit_permission_code(request, DeliveryPermissions.SOD_OVERRIDE)
                ):
                    raise SeparationOfDuties()
                kind = DeliveryStatusChange.Kind.SELF_APPROVAL.value
            items.refresh(locked)
            result = qc.run(locked, actor)
            if result["passed"]:
                now = timezone.now()
                transitions.move(
                    locked,
                    wf.SIGNED_OFF,
                    actor=actor,
                    request=request,
                    reason=(override_reason or "").strip() if kind else (notes or "").strip(),
                    override_kind=kind,
                    extra={"signed_off_by": _actor_or_none(actor), "signed_off_at": now},
                )
                audit.record(
                    actor=actor,
                    action=AuditLog.ACTION_UPDATE,
                    package=locked,
                    description=f"Delivery {locked.code} signed off"
                    + (" (self sign-off override)" if kind else ""),
                    metadata={"run_id": str(result["run_id"]), "self_approval": bool(kind)},
                )
        if not result["passed"]:
            raise cls._qc_failed(result)
        return locked

    @classmethod
    @transaction.atomic
    def reopen(cls, *, actor: Any, package: Any, request: Any = None) -> DeliveryPackage:
        """Take back a sign-off: Signed Off to Prepared. The sign-off is cleared."""
        locked = cls._lock(package)
        if locked.status != wf.SIGNED_OFF:
            raise transitions.refuse(locked.status, wf.PREPARED)
        transitions.move(
            locked,
            wf.PREPARED,
            actor=actor,
            request=request,
            extra={"signed_off_by": None, "signed_off_at": None},
        )
        audit.record(
            actor=actor,
            action=AuditLog.ACTION_UPDATE,
            package=locked,
            description=f"Delivery {locked.code} sign-off withdrawn",
        )
        return locked

    @classmethod
    def send(
        cls,
        *,
        actor: Any,
        package: Any,
        transfer_reference: str = "",
        request: Any = None,
    ) -> DeliveryPackage:
        """
        Record that the delivery was sent: Signed Off to Submitted, once.

        QC runs one last time on what was signed off (a file registered, deprecated or revoked since
        then fails ``snapshot_current`` and the delivery stays Signed Off for someone to reopen). On
        success the manifest is rebuilt, the snapshot frozen and who and when recorded (the real
        time). A second send, or one racing the first, is a 409. If QC fails nothing is sent and the
        409 is raised after the run's rows are committed. StudioHub does not transfer anything (Q4).
        """
        with transaction.atomic():
            locked = cls._lock(package)
            if locked.status != wf.SIGNED_OFF or locked.sent_at is not None:
                raise transitions.refuse(locked.status, wf.SUBMITTED)
            result = qc.run(locked, actor)
            if result["passed"]:
                manifest_data, checksums = manifest.build(locked)
                now = timezone.now()
                items.freeze(locked)
                transitions.move(
                    locked,
                    wf.SUBMITTED,
                    actor=actor,
                    request=request,
                    extra={
                        "manifest_data": manifest_data,
                        "checksums": checksums,
                        "sent_by": _actor_or_none(actor),
                        "sent_at": now,
                        "transfer_reference": (transfer_reference or "").strip()[:200],
                    },
                )
                audit.record(
                    actor=actor,
                    action=AuditLog.ACTION_EXPORT,
                    package=locked,
                    description=f"Delivery {locked.code} submitted via {locked.delivery_method}",
                    metadata={
                        "run_id": str(result["run_id"]),
                        "sent_at": now.isoformat(),
                        "transfer_reference_given": bool(locked.transfer_reference),
                    },
                )
        if not result["passed"]:
            raise cls._qc_failed(result)
        return locked

    # -- after the send --------------------------------------------------------------------

    @classmethod
    @transaction.atomic
    def record_client_answer(
        cls,
        *,
        actor: Any,
        package: Any,
        accepted: bool,
        reason: str = "",
        notes: str = "",
        request: Any = None,
    ) -> DeliveryPackage:
        """
        Record what the client answered: Submitted to Approved or Rejected. A rejection needs a
        reason (kept in its own column, never in the client's notes); ``notes`` is the client's
        feedback.
        """
        reason = (reason or "").strip()
        if not accepted and not reason:
            raise ValidationError({"rejection_reason": ["A reason is required."]})
        locked = cls._lock(package)
        target = wf.APPROVED if accepted else wf.REJECTED
        extra: dict[str, Any] = {
            "client_status": (
                DeliveryPackage.CLIENT_STATUS_APPROVED
                if accepted
                else DeliveryPackage.CLIENT_STATUS_REJECTED
            ),
            "client_answered_by": _actor_or_none(actor),
            "client_answered_at": timezone.now(),
        }
        if notes:
            extra["client_notes"] = notes
        if not accepted:
            extra["rejection_reason"] = reason[:500]
        transitions.move(
            locked,
            target,
            actor=actor,
            request=request,
            reason="" if accepted else reason,
            extra=extra,
        )
        audit.record(
            actor=actor,
            action=AuditLog.ACTION_UPDATE,
            package=locked,
            description=f"Delivery {locked.code} {'approved' if accepted else 'rejected'} by the client",
        )
        return locked

    @classmethod
    @transaction.atomic
    def complete(cls, *, actor: Any, package: Any, request: Any = None) -> DeliveryPackage:
        """Approved to Complete."""
        locked = cls._lock(package)
        transitions.move(locked, wf.COMPLETE, actor=actor, request=request)
        audit.record(
            actor=actor,
            action=AuditLog.ACTION_EXPORT,
            package=locked,
            description=f"Delivery {locked.code} marked as complete",
        )
        return locked

    @classmethod
    @transaction.atomic
    def cancel(
        cls, *, actor: Any, package: Any, reason: str = "", request: Any = None
    ) -> DeliveryPackage:
        """Cancel a delivery that has not been sent (a signed-off one needs ``delivery.approve``)."""
        locked = cls._lock(package)
        transitions.move(
            locked,
            wf.CANCELLED,
            actor=actor,
            request=request,
            reason=(reason or "").strip(),
            extra={"cancellation_reason": (reason or "").strip()[:500]},
        )
        audit.record(
            actor=actor,
            action=AuditLog.ACTION_DELETE,
            package=locked,
            description=f"Delivery {locked.code} cancelled",
        )
        return locked

    @classmethod
    @transaction.atomic
    def override_status(
        cls,
        *,
        actor: Any,
        package: Any,
        target: str,
        override_reason: str,
        request: Any,
    ) -> DeliveryPackage:
        """
        Correct the status of a sent or cancelled delivery outside the map. Needs
        ``delivery.status.override`` (granted to no role) and a reason. Service-only: no endpoint.
        """
        locked = cls._lock(package)
        transitions.move(
            locked, target, actor=actor, request=request, override_reason=override_reason
        )
        audit.record(
            actor=actor,
            action=AuditLog.ACTION_UPDATE,
            package=locked,
            description=f"Delivery {locked.code} status corrected to {target} (override)",
            severity=AuditLog.SEVERITY_WARNING,
        )
        return locked

    @classmethod
    @transaction.atomic
    def revise(
        cls, *, actor: Any, package: Any, request: Any = None
    ) -> tuple[DeliveryPackage, list[dict[str, str]]]:
        """
        Re-deliver a rejected delivery: a new Draft with ``revision_of`` set and the same versions,
        refreshed from the registry. A version that is no longer deliverable is left out and
        reported (``[{"version_id", "reason"}]``) rather than silently dropped. The passcode is not
        copied. One live revision per rejected delivery.
        """
        old = cls._lock(package)
        if old.status != wf.REJECTED:
            raise transitions.refuse(old.status, wf.DRAFT)
        if request is not None and not has_permission_code(request, DeliveryPermissions.SEND):
            raise TransitionNotPermitted()
        if old.revisions.exclude(status=wf.CANCELLED).exists():  # pyright: ignore[reportAttributeAccessIssue]
            raise AlreadyRevised()
        project = old.project
        new = DeliveryPackage.objects.create(
            name=old.name,
            code=numbering.allocate_code(project) if project else f"{old.code}-R",
            project=project,
            client=old.client,
            delivery_method=old.delivery_method,
            delivery_destination=old.delivery_destination,
            expires_at=old.expires_at,
            notes=old.notes,
            revision_of=old,
            created_by=_actor_or_none(actor),
        )
        transitions.record_creation(new, actor)
        skipped: list[dict[str, str]] = []
        for ref in old.versions.select_related("version"):  # pyright: ignore[reportAttributeAccessIssue]
            try:
                version, files = items.check_deliverable(new.project_id, ref.version_id)  # pyright: ignore[reportAttributeAccessIssue]
            except UndeliverableVersion as error:
                skipped.append({"version_id": str(ref.version_id), "reason": error.reason})
                continue
            copy = DeliveryVersionRef.objects.create(
                delivery=new,
                version=version,
                added_by=_actor_or_none(actor),
                version_number=version.version_number,
                entity_type=version.entity_type,
                entity_code=version.entity_code,
                entity_name=version.entity_name,
                file_path="",
            )
            items.apply_snapshot(copy, version, files)
        audit.record(
            actor=actor,
            action=AuditLog.ACTION_CREATE,
            package=new,
            description=f"Delivery {new.code} created as a revision of {old.code}",
            metadata={"revision_of": str(old.pk), "skipped_versions": len(skipped)},
        )
        return new, skipped
