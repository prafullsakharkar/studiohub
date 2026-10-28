"""
Project milestones (docs/scheduling/CONTRACTS.md DOM-SCH-06, decision Q22).

A milestone belongs to one project the caller may use; its name is unique within the project in any
case; a delivery milestone names a delivery of the same project, checked through the
``deliveries.project_figures`` provider (Scheduling does not import Deliveries; with the provider
absent a delivery cannot be verified and is refused). Completed is reached only through ``complete``
and left only through ``reopen``, so who completed it and when is always recorded.
"""

from __future__ import annotations

from typing import Any

from django.db import IntegrityError, transaction
from django.db.models.functions import Upper
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.audit.models import AuditLog
from apps.core import providers
from apps.core.api.exceptions.api import NotFoundException
from apps.scheduling.models import Milestone
from apps.scheduling.services import audit

#: the name Deliveries registers its figures under (docs/delivery-pipeline/CONTRACTS.md X-05)
DELIVERY_FIGURES = "deliveries.project_figures"

EDITABLE_FIELDS = ("name", "due_date", "order", "notes")


def _actor_or_none(actor: Any):
    return actor if getattr(actor, "is_authenticated", False) else None


def _check_name(project: Any, name: str, *, exclude: Any = None) -> None:
    clash = Milestone.objects.annotate(uname=Upper("name")).filter(
        project=project, uname=name.strip().upper()
    )
    if exclude is not None:
        clash = clash.exclude(pk=exclude)
    if clash.exists():
        raise ValidationError({"name": ["This project already has a milestone with this name."]})


def _check_delivery(project: Any, kind: str, delivery_id: Any) -> None:
    """A delivery milestone names a delivery of the project; a general one names none."""
    if kind == Milestone.KIND_GENERAL:
        if delivery_id is not None:
            raise ValidationError(
                {"delivery_package_id": ["Only a delivery milestone names a delivery."]}
            )
        return
    if delivery_id is None:
        raise ValidationError({"delivery_package_id": ["A delivery milestone needs a delivery."]})
    figures = providers.get(DELIVERY_FIGURES)
    if figures is None:
        raise ValidationError(
            {"delivery_package_id": ["Deliveries are not available, so this cannot be checked."]}
        )
    if str(delivery_id) not in {str(pk) for pk in figures.entity_ids(project)}:
        raise ValidationError({"delivery_package_id": ["Unknown delivery."]})


class MilestoneService:
    @staticmethod
    def _lock(milestone: Any) -> Milestone:
        pk = getattr(milestone, "pk", milestone)
        try:
            return Milestone.objects.select_for_update().select_related("project").get(pk=pk)
        except Milestone.DoesNotExist as error:
            raise NotFoundException() from error

    @classmethod
    @transaction.atomic
    def create(cls, *, actor: Any, project: Any, data: dict[str, Any]) -> Milestone:
        """Create a milestone of ``project`` (already resolved to one the caller may use)."""
        name = (data.get("name") or "").strip()
        if not name:
            raise ValidationError({"name": ["A name is required."]})
        _check_name(project, name)
        kind = data.get("kind") or Milestone.KIND_GENERAL
        delivery_id = data.get("delivery_package_id")
        _check_delivery(project, kind, delivery_id)
        try:
            with transaction.atomic():
                return Milestone.objects.create(
                    project=project,
                    name=name,
                    due_date=data["due_date"],
                    order=data.get("order", 0),
                    kind=kind,
                    delivery_package_id=delivery_id,
                    notes=data.get("notes", ""),
                    created_by=_actor_or_none(actor),
                )
        except IntegrityError as error:
            raise ValidationError(
                {"name": ["This project already has a milestone with this name."]}
            ) from error

    @classmethod
    @transaction.atomic
    def update(cls, *, actor: Any, milestone: Any, data: dict[str, Any]) -> Milestone:
        """
        Edit a milestone. ``status`` may move between Pending and In Progress; Completed is reached
        with ``complete`` and left with ``reopen``. The project is not editable.
        """
        locked = cls._lock(milestone)
        if "name" in data:
            data["name"] = (data["name"] or "").strip()
            if not data["name"]:
                raise ValidationError({"name": ["A name is required."]})
            _check_name(locked.project, data["name"], exclude=locked.pk)
        kind = data.get("kind", locked.kind)
        delivery_id = data.get("delivery_package_id", locked.delivery_package_id)
        if "kind" in data or "delivery_package_id" in data:
            _check_delivery(locked.project, kind, delivery_id)
            locked.kind, locked.delivery_package_id = kind, delivery_id
        if "status" in data and data["status"] != locked.status:
            if data["status"] == Milestone.STATUS_COMPLETED:
                raise ValidationError({"status": ["Use the complete action."]})
            if locked.status == Milestone.STATUS_COMPLETED:
                raise ValidationError({"status": ["Use the reopen action."]})
            locked.status = data["status"]
        for name in EDITABLE_FIELDS:
            if name in data:
                setattr(locked, name, data[name])
        locked.updated_by = _actor_or_none(actor)
        try:
            with transaction.atomic():
                locked.save()
        except IntegrityError as error:
            raise ValidationError(
                {"name": ["This project already has a milestone with this name."]}
            ) from error
        return locked

    @classmethod
    @transaction.atomic
    def complete(cls, *, actor: Any, milestone: Any) -> Milestone:
        """Pending or In Progress to Completed, recording who and when."""
        locked = cls._lock(milestone)
        if locked.status == Milestone.STATUS_COMPLETED:
            raise ValidationError({"status": ["This milestone is already completed."]})
        locked.status = Milestone.STATUS_COMPLETED
        locked.completed_at = timezone.now()
        locked.completed_by = _actor_or_none(actor)
        locked.updated_by = _actor_or_none(actor)
        locked.save(
            update_fields=["status", "completed_at", "completed_by", "updated_by", "updated_at"]
        )
        cls._audit(actor, locked, "completed")
        return locked

    @staticmethod
    def _audit(actor: Any, milestone: Any, what: str) -> None:
        audit.record(
            actor=actor,
            action=AuditLog.ACTION_UPDATE,
            target_id=milestone.pk,
            target_name=f"Milestone {milestone.name}",
            description=f"Milestone {milestone.name} {what}",
            metadata={
                "event": f"milestone.{what}",
                "project_id": str(milestone.project_id),
                "due_date": str(milestone.due_date),
            },
        )

    @classmethod
    @transaction.atomic
    def reopen(cls, *, actor: Any, milestone: Any) -> Milestone:
        """Completed back to In Progress, clearing who and when it was completed."""
        locked = cls._lock(milestone)
        if locked.status != Milestone.STATUS_COMPLETED:
            raise ValidationError({"status": ["Only a completed milestone can be reopened."]})
        locked.status = Milestone.STATUS_IN_PROGRESS
        locked.completed_at = None
        locked.completed_by = None
        locked.updated_by = _actor_or_none(actor)
        locked.save(
            update_fields=["status", "completed_at", "completed_by", "updated_by", "updated_at"]
        )
        cls._audit(actor, locked, "reopened")
        return locked
