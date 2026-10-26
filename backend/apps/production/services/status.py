"""
Status transitions.

``StatusService.transition_status`` is the only code that changes the status
of a shot, task, version, review or timelog. It checks the move against
``constants.workflow``, the permission the move needs, writes the append-only
``StatusHistory`` row and publishes ``StatusChanged``.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from django.db import transaction

from apps.core.events import default_event_bus
from apps.core.logging.logger import get_logger
from apps.production.constants import workflow
from apps.production.events.status import StatusChanged
from apps.production.exceptions import InvalidTransition, TransitionNotPermitted
from apps.production.models import StatusHistory
from apps.production.permissions.checks import user_has_permission_code

logger = get_logger("production")

PermissionCheck = Callable[[str], bool]


class StatusService:
    @classmethod
    def entity_key(cls, entity: Any) -> str:
        return workflow.ENTITY_FOR_MODEL[type(entity).__name__]

    @classmethod
    def supports(cls, entity: Any) -> bool:
        return type(entity).__name__ in workflow.ENTITY_FOR_MODEL

    @classmethod
    def check(
        cls,
        *,
        entity: Any,
        to_status: str,
        from_status: str | None = None,
        actor: Any = None,
        has_permission: PermissionCheck | None = None,
    ) -> None:
        """
        Raise unless ``entity`` may move to ``to_status``.

        ``InvalidTransition`` (400) for an unknown status or a move the map does
        not allow, ``TransitionNotPermitted`` (403) for a missing permission.
        ``from_status`` defaults to the entity's current status.
        """
        key = cls.entity_key(entity)
        current = entity.status if from_status is None else from_status
        if to_status not in workflow.valid_statuses(key):
            raise InvalidTransition({"status": [f"Unknown status {to_status!r}."]})
        if not workflow.is_allowed(key, current, to_status):
            raise InvalidTransition(
                {"status": [f"A {key} cannot move from {current!r} to {to_status!r}."]}
            )
        allowed = has_permission or (lambda code: user_has_permission_code(actor, code))
        for code in workflow.required_permissions(key, current, to_status):
            if not allowed(code):
                raise TransitionNotPermitted(
                    f"Moving a {key} from {current!r} to {to_status!r} requires {code}."
                )

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
        allowed = has_permission or (lambda code: user_has_permission_code(actor, code))
        for code in workflow.required_permissions(entity_key, None, to_status):
            if not allowed(code):
                raise TransitionNotPermitted(
                    f"Creating a {entity_key} as {to_status!r} requires {code}."
                )

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
        enforce: bool = True,
    ) -> Any:
        """
        Move ``entity`` to ``to_status``; return it.

        The row is locked first so two simultaneous moves cannot both start from
        the same status. A move to the current status is a no-op without
        history. ``enforce=False`` skips the map and permission checks for
        system moves (archive/restore bookkeeping) and still writes history.
        """
        locked = type(entity)._base_manager.select_for_update().get(pk=entity.pk)
        from_status = locked.status
        if from_status == to_status:
            entity.status = to_status
            return entity
        if enforce:
            cls.check(
                entity=locked,
                to_status=to_status,
                actor=actor,
                has_permission=has_permission,
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
            entity=entity, actor=actor, from_status=from_status, to_status=to_status, reason=reason
        )
        return entity

    @classmethod
    def _record(
        cls, *, entity: Any, actor: Any, from_status: str, to_status: str, reason: str
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
            )
        else:
            logger.warning(
                "status_history_skipped_no_project",
                entity_type=type(entity).__name__,
                entity_id=str(entity.pk),
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
            )
        )
