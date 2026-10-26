"""
Status transitions.

``StatusService.transition_status`` is the only code that changes the status
of a shot, task, version, review or timelog. Under a row lock it checks the move
against ``constants.workflow``, the permission the move needs and separation of
duties, then writes the append-only ``StatusHistory`` row and publishes
``StatusChanged``.

Two opt-in permissions let a caller cross a fence, each with a mandatory
reason and a ``StatusHistory.override_kind`` so every use can be found:
``production.status.override`` (a move the workflow forbids) and
``production.sod.override`` (approving work one produced). Neither is implied by
superuser.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from django.db import transaction

from apps.core.events import default_event_bus
from apps.core.logging.logger import get_logger
from apps.production.constants import workflow
from apps.production.constants.permissions import OverridePermissions
from apps.production.events.status import StatusChanged
from apps.production.exceptions import (
    InvalidTransition,
    SeparationOfDuties,
    StatusConflict,
    TransitionNotPermitted,
)
from apps.production.models import StatusHistory
from apps.production.permissions.checks import (
    user_has_explicit_permission_code,
    user_has_permission_code,
)
from apps.production.services import separation

logger = get_logger("production")

PermissionCheck = Callable[[str], bool]

OVERRIDE_STATUS = "status"
OVERRIDE_SELF_APPROVAL = "self_approval"


class StatusService:
    @classmethod
    def entity_key(cls, entity: Any) -> str:
        return workflow.ENTITY_FOR_MODEL[type(entity).__name__]

    @classmethod
    def supports(cls, entity: Any) -> bool:
        return type(entity).__name__ in workflow.ENTITY_FOR_MODEL

    # -- checks ---------------------------------------------------------

    @classmethod
    def _checks(
        cls,
        actor: Any,
        has_permission: PermissionCheck | None,
        has_explicit: PermissionCheck | None,
    ) -> tuple[PermissionCheck, PermissionCheck]:
        return (
            has_permission or (lambda code: user_has_permission_code(actor, code)),
            has_explicit or (lambda code: user_has_explicit_permission_code(actor, code)),
        )

    @classmethod
    def check(
        cls,
        *,
        entity: Any,
        to_status: str,
        from_status: str | None = None,
        actor: Any = None,
        has_permission: PermissionCheck | None = None,
        has_explicit: PermissionCheck | None = None,
        override_reason: str | None = None,
    ) -> str:
        """
        Raise unless ``actor`` may move ``entity`` to ``to_status``; return the
        override kinds the move relies on (``""`` when none, else joined by ``+``).

        ``InvalidTransition`` (400): unknown status or a move the table forbids.
        ``TransitionNotPermitted`` (403): a missing permission.
        ``SeparationOfDuties`` (403): the actor produced the work.
        """
        key = cls.entity_key(entity)
        allowed, explicit = cls._checks(actor, has_permission, has_explicit)
        current = entity.status if from_status is None else from_status
        reason = (override_reason or "").strip()
        kinds: list[str] = []

        if to_status not in workflow.valid_statuses(key):
            raise InvalidTransition({"status": [f"Unknown status {to_status!r}."]})

        frozen = key in workflow.FROZEN_WHEN_PUBLISHED and getattr(entity, "is_published", False)
        if frozen or not workflow.is_allowed(key, current, to_status):
            why = (
                f"A published {key} cannot change status."
                if frozen
                else f"A {key} cannot move from {current!r} to {to_status!r}."
            )
            if key in workflow.OVERRIDABLE and explicit(OverridePermissions.STATUS):
                if not reason:
                    raise InvalidTransition(
                        {"override_reason": [f"{why} A reason is required to override."]}
                    )
                kinds.append(OVERRIDE_STATUS)
            else:
                raise InvalidTransition({"status": [why]})

        for code in workflow.required_permissions(key, current, to_status):
            if not allowed(code):
                raise TransitionNotPermitted(
                    f"Moving a {key} from {current!r} to {to_status!r} requires {code}."
                )

        if workflow.needs_separation(key, to_status):
            kind = cls.check_separation(
                entity=entity,
                to_status=to_status,
                actor=actor,
                has_explicit=explicit,
                override_reason=reason,
            )
            if kind:
                kinds.append(kind)
        return "+".join(kinds)

    @classmethod
    def check_separation(
        cls,
        *,
        entity: Any,
        to_status: str,
        actor: Any,
        has_explicit: PermissionCheck | None = None,
        override_reason: str | None = None,
    ) -> str:
        """
        Refuse an approval by someone who produced the work.

        Returns ``"self_approval"`` when the actor is allowed through by
        ``production.sod.override`` (with a reason), ``""`` when there is no conflict.
        """
        key = cls.entity_key(entity)
        if not workflow.needs_separation(key, to_status):
            return ""
        actor_id = getattr(actor, "pk", None)
        if actor_id is None or actor_id not in separation.producers(entity):
            return ""
        explicit = has_explicit or (lambda code: user_has_explicit_permission_code(actor, code))
        if not explicit(OverridePermissions.SELF_APPROVAL):
            raise SeparationOfDuties(f"You cannot approve a {key} you produced.")
        if not (override_reason or "").strip():
            raise SeparationOfDuties(
                {"override_reason": [f"A reason is required to approve a {key} you produced."]}
            )
        return OVERRIDE_SELF_APPROVAL

    @classmethod
    def check_initial(
        cls,
        *,
        entity_key: str,
        to_status: str,
        actor: Any = None,
        has_permission: PermissionCheck | None = None,
    ) -> None:
        """Permission check for creating a record that already has ``to_status``."""
        allowed, _ = cls._checks(actor, has_permission, None)
        for code in workflow.required_permissions(entity_key, None, to_status):
            if not allowed(code):
                raise TransitionNotPermitted(
                    f"Creating a {entity_key} as {to_status!r} requires {code}."
                )

    # -- transitions ----------------------------------------------------

    @classmethod
    @transaction.atomic
    def transition_status(
        cls,
        *,
        actor: Any,
        entity: Any,
        to_status: str,
        reason: str = "",
        has_permission: PermissionCheck | None = None,
        has_explicit: PermissionCheck | None = None,
        override_reason: str | None = None,
        enforce: bool = True,
        strict: bool = False,
    ) -> Any:
        """
        Move ``entity`` to ``to_status``; return it.

        The row is locked and its status re-read under the lock, so two
        simultaneous moves cannot both start from the same status: the second
        sees the first's result. A move to the status the row already has is a
        no-op, or with ``strict`` a ``StatusConflict`` (409), which is what an
        action such as "approve" wants when someone else approved first.
        ``enforce=False`` skips every check for system moves (archive/restore
        bookkeeping) and still writes history.
        """
        locked = type(entity)._base_manager.select_for_update().get(pk=entity.pk)
        from_status = locked.status
        if from_status == to_status:
            if strict:
                raise StatusConflict(f"The {cls.entity_key(entity)} is already {to_status!r}.")
            entity.status = to_status
            return entity
        override_kind = ""
        if enforce:
            override_kind = cls.check(
                entity=locked,
                to_status=to_status,
                actor=actor,
                has_permission=has_permission,
                has_explicit=has_explicit,
                override_reason=override_reason,
            )
        entity.status = to_status
        fields = ["status"]
        if hasattr(entity, "updated_at"):
            fields.append("updated_at")
        if hasattr(entity, "updated_by") and getattr(actor, "is_authenticated", False):
            entity.updated_by = actor
            fields.append("updated_by")
        entity.save(update_fields=fields)
        cls._record(
            entity=entity,
            actor=actor,
            from_status=from_status,
            to_status=to_status,
            reason=(override_reason or reason) if override_kind else reason,
            override_kind=override_kind,
        )
        return entity

    @classmethod
    def record_override(
        cls, *, entity: Any, actor: Any, override_kind: str, reason: str, note: str = ""
    ) -> None:
        """History row for an override that did not change the status (a verdict by the producer)."""
        cls._record(
            entity=entity,
            actor=actor,
            from_status=entity.status,
            to_status=entity.status,
            reason=f"{note}: {reason}" if note else reason,
            override_kind=override_kind,
        )

    @classmethod
    def restore_status(cls, *, actor: Any, entity: Any) -> Any:
        """
        Take a restored record out of ``Archived``: back to the status it had before
        it was archived (from the history), else the first working status.
        """
        if entity.status != workflow.ARCHIVED:
            return entity
        key = cls.entity_key(entity)
        previous = (
            StatusHistory.objects.filter(
                entity_type=type(entity).__name__, entity_id=entity.pk, to_status=workflow.ARCHIVED
            )
            .order_by("-changed_at")
            .values_list("from_status", flat=True)
            .first()
        )
        valid = workflow.valid_statuses(key)
        target = previous if previous in valid and previous != workflow.ARCHIVED else "Not Started"
        return cls.transition_status(
            actor=actor, entity=entity, to_status=target, reason="restored", enforce=False
        )

    @classmethod
    def _record(
        cls,
        *,
        entity: Any,
        actor: Any,
        from_status: str,
        to_status: str,
        reason: str,
        override_kind: str = "",
    ) -> None:
        project_id = getattr(entity, "project_id", None)
        if project_id is None:
            task = getattr(entity, "task", None)
            project_id = getattr(task, "project_id", None)
        actor_id = actor.pk if getattr(actor, "is_authenticated", False) else None
        if project_id is not None:
            StatusHistory.objects.create(
                project_id=project_id,
                entity_type=type(entity).__name__,
                entity_id=entity.pk,
                entity_code=(getattr(entity, "code", "") or getattr(entity, "task_code", ""))[:100],
                from_status=from_status,
                to_status=to_status,
                actor_id=actor_id,
                reason=reason or "",
                override_kind=override_kind,
            )
        else:
            logger.warning(
                "status_history_skipped_no_project",
                entity_type=type(entity).__name__,
                entity_id=str(entity.pk),
            )
        if override_kind:
            logger.warning(
                "status_override_used",
                entity_type=type(entity).__name__,
                entity_id=str(entity.pk),
                actor_id=str(actor_id) if actor_id else None,
                override_kind=override_kind,
            )
        default_event_bus.publish(
            StatusChanged(
                entity_type=type(entity).__name__,
                entity_id=str(entity.pk),
                project_id=str(project_id) if project_id else None,
                from_status=from_status,
                to_status=to_status,
                actor_id=str(actor_id) if actor_id else None,
                reason=reason or "",
                override_kind=override_kind,
            )
        )
