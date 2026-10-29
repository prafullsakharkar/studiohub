"""
The only writer of ``DeliveryPackage.status`` (docs/deliveries/CONTRACTS.md DOM-DLV-02, DOM-DLV-11).

``move`` works on a package the caller has already locked (``select_for_update``) and whose status
it has just read, so of two requests that race the loser sees the winner's status and gets a 409.
Every move writes one ``DeliveryStatusChange`` row in the same transaction.

* A move in the map (``constants.workflow.TRANSITIONS``) needs the permission code the map names.
  When a request is given it is checked here, on every path, not only by the viewset; internal
  callers pass no request and are trusted (A-12 of the publishing assumptions applies here too).
* A move out of a sent or cancelled delivery that the map does not offer needs
  ``delivery.status.override`` (checked explicitly, so a superuser does not hold it) and a reason;
  the history row says ``override_kind="status"``.
* ``system=True`` is for moves the platform makes itself (a revoked file); only map moves, with
  ``override_kind="system"`` and no actor.
"""

from __future__ import annotations

from typing import Any

from rest_framework.exceptions import ValidationError

from apps.deliveries.constants import workflow as wf
from apps.deliveries.constants.permissions import DeliveryPermissions
from apps.deliveries.exceptions import InvalidTransition, TransitionNotPermitted
from apps.deliveries.models import DeliveryPackage, DeliveryStatusChange
from apps.production.permissions.checks import has_explicit_permission_code, has_permission_code

KIND_STATUS = DeliveryStatusChange.Kind.STATUS.value
KIND_SYSTEM = DeliveryStatusChange.Kind.SYSTEM.value


def _actor_or_none(actor: Any):
    return actor if getattr(actor, "is_authenticated", False) else None


def refuse(source: str, target: str) -> InvalidTransition:
    # Also the loser of a race: the winner already moved the delivery.
    return InvalidTransition({"code": "invalid_transition", "from": source, "to": target})  # pyright: ignore[reportArgumentType]


def record_creation(package: DeliveryPackage, actor: Any) -> None:
    """The history row that says who created the delivery (separation of duties reads it)."""
    DeliveryStatusChange.objects.create(
        delivery=package,
        from_status="",
        to_status=package.status,
        actor=_actor_or_none(actor),
    )


def move(
    package: DeliveryPackage,
    target: str,
    *,
    actor: Any,
    request: Any = None,
    reason: str = "",
    override_reason: str | None = None,
    system: bool = False,
    override_kind: str = "",
    extra: dict[str, Any] | None = None,
) -> str:
    """
    Move a locked package to ``target`` and record it. Returns the override kind ('' for an
    ordinary move). ``override_kind`` labels an ordinary move the caller already authorised by
    another override (the self sign-off). ``extra`` are other columns saved in the same write
    (``sent_at``, ...).
    """
    source = package.status
    kind = ""
    if system:
        if not wf.can_move(source, target):
            raise refuse(source, target)
        kind = KIND_SYSTEM
    elif wf.can_move(source, target):
        code = wf.required_permission(source, target)
        if request is not None and code and not has_permission_code(request, code):
            raise TransitionNotPermitted()
        kind = override_kind
    elif override_reason is not None and wf.needs_override(source, target):
        # Only a caller that asks for the override gets it; the ordinary actions never do, so
        # a cancel or complete of a sent delivery is the plain 409 of the map.
        if not override_reason.strip():
            raise ValidationError({"override_reason": ["Required to leave this status."]})
        if request is None or not has_explicit_permission_code(
            request, DeliveryPermissions.STATUS_OVERRIDE
        ):
            raise TransitionNotPermitted()
        kind = KIND_STATUS
        reason = (override_reason or "").strip()
    else:
        raise refuse(source, target)

    package.status = target
    fields = ["status", "updated_at"]
    for name, value in (extra or {}).items():
        setattr(package, name, value)
        fields.append(name)
    package.save(update_fields=fields)
    DeliveryStatusChange.objects.create(
        delivery=package,
        from_status=source,
        to_status=target,
        actor=None if system else _actor_or_none(actor),
        reason=reason[:500],
        override_kind=kind,
    )
    return kind
