"""
Delivery use cases (docs/deliveries/CONTRACTS.md DOM-DLV-01 to DOM-DLV-06).

Every public method is one ``transaction.atomic()`` and takes a row lock on the package, so of two
requests that race (two sends, two adds of the same version) the loser sees the winner's result.
Authorization by project membership is Phase 8; the viewset gates these with ``delivery.update``
for now. Moving a delivery through approval is Phase 7: this module only writes the statuses the
core model needs (Validating, Prepared, Submitted).
"""

from __future__ import annotations

from typing import Any

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.audit.models import AuditLog
from apps.core.api.exceptions.api import NotFoundException
from apps.deliveries.constants import workflow as wf
from apps.deliveries.exceptions import DeliveryNotEditable, InvalidTransition, QCFailed
from apps.deliveries.models import DeliveryPackage, DeliveryVersionRef
from apps.deliveries.services import audit, items, manifest, numbering, qc
from apps.masterdata.selectors.directory import ClientSelector
from apps.production.selectors.project import ProjectSelector

EDITABLE_FIELDS = (
    "name",
    "delivery_method",
    "delivery_destination",
    "passcode",
    "expires_at",
    "notes",
    "client_notes",
)


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

    @staticmethod
    def _refuse(source: str, target: str) -> InvalidTransition:
        # Also the loser of a race: the winner already moved the delivery.
        return InvalidTransition({"code": "invalid_transition", "from": source, "to": target})  # pyright: ignore[reportArgumentType]

    @classmethod
    def _require_editable(cls, package: DeliveryPackage) -> None:
        if not is_editable(package):
            raise DeliveryNotEditable()

    # -- create / edit --------------------------------------------------------------------

    @classmethod
    @transaction.atomic
    def create(cls, *, actor: Any, data: dict[str, Any]) -> DeliveryPackage:
        """
        Create a delivery. A blank code is numbered by the server from the project; a code that is
        sent must be unused in any case. An unknown project or client is a 400.
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
            passcode=data.get("passcode") or "",
            expires_at=data.get("expires_at"),
            notes=data.get("notes", ""),
            client_notes=data.get("client_notes", ""),
            created_by=_actor_or_none(actor),
        )
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

    # -- QC, prepare, send -----------------------------------------------------------------

    @classmethod
    @transaction.atomic
    def validate(cls, *, actor: Any, package: Any) -> tuple[DeliveryPackage, dict[str, Any]]:
        """Run QC and record it. A Draft delivery becomes Validating; the other editable ones keep their status."""
        locked = cls._lock(package)
        cls._require_editable(locked)
        result = qc.run(locked, actor)
        if locked.status == wf.DRAFT:
            locked.status = wf.VALIDATING
            locked.save(update_fields=["status", "updated_at"])
        audit.record(
            actor=actor,
            action=AuditLog.ACTION_UPDATE,
            package=locked,
            description=f"Delivery {locked.code} validated: {'passed' if result['passed'] else 'failed'}",
            metadata={"run_id": str(result["run_id"]), "passed": result["passed"]},
        )
        return locked, result

    @classmethod
    def prepare(cls, *, actor: Any, package: Any) -> tuple[DeliveryPackage, dict[str, Any]]:
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
                locked.status = wf.PREPARED
                locked.save(update_fields=["manifest_data", "checksums", "status", "updated_at"])
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
            raise QCFailed({"code": "qc_failed", "checks": qc.failures(result)})  # pyright: ignore[reportArgumentType]
        return locked, result

    @classmethod
    def send(cls, *, actor: Any, package: Any, transfer_reference: str = "") -> DeliveryPackage:
        """
        Record that the delivery was sent: Prepared to Submitted, once.

        Refreshes the items one last time, requires QC to pass, rebuilds the manifest, freezes the
        snapshot and records who sent it and when (the real time). A second send, or one racing the
        first, is a 409. If QC fails, nothing is sent and the 409 is raised after the run's rows are
        committed. StudioHub does not transfer anything (decision Q4).
        """
        with transaction.atomic():
            locked = cls._lock(package)
            if locked.status != wf.PREPARED or locked.sent_at is not None:
                raise cls._refuse(locked.status, wf.SUBMITTED)
            items.refresh(locked)
            result = qc.run(locked, actor)
            if result["passed"]:
                cls._seal(locked, actor, result, transfer_reference)
        if not result["passed"]:
            raise QCFailed({"code": "qc_failed", "checks": qc.failures(result)})  # pyright: ignore[reportArgumentType]
        return locked

    @classmethod
    def _seal(
        cls, locked: DeliveryPackage, actor: Any, result: dict[str, Any], transfer_reference: str
    ) -> None:
        """Freeze the items, build the manifest and mark ``locked`` Submitted (inside the send transaction)."""
        manifest_data, checksums = manifest.build(locked)
        now = timezone.now()
        items.freeze(locked)
        locked.manifest_data = manifest_data
        locked.checksums = checksums
        locked.status = wf.SUBMITTED
        locked.sent_by = _actor_or_none(actor)
        locked.sent_at = now
        locked.transfer_reference = (transfer_reference or "").strip()[:200]
        locked.save(
            update_fields=[
                "manifest_data",
                "checksums",
                "status",
                "sent_by",
                "sent_at",
                "transfer_reference",
                "updated_at",
            ]
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
