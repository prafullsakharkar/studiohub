"""
The delivery transition map (docs/deliveries/CONTRACTS.md DOM-DLV-02, decisions Q16 and Q27).

One table: ``TRANSITIONS[source][target]`` is the permission code the move needs on top of
``delivery.view``. ``services.transitions.move`` is the only writer of ``DeliveryPackage.status``
and reads this table; actions, the admin and bulk operations cannot move a delivery any other way.

::

    Draft, Validating, Prepared   (working states: move among each other, items can change)
        Prepared ──sign-off──> Signed Off ──send──> Submitted ──> Approved ──> Complete
                                   │                    └──────> Rejected
        working states, Signed Off ──cancel──> Cancelled

Leaving Submitted, Approved, Rejected, Complete or Cancelled by any other route is a correction:
it needs ``delivery.status.override`` and a reason (``needs_override``).
"""

from __future__ import annotations

from apps.deliveries.constants.permissions import DeliveryPermissions as P

DRAFT = "Draft"
VALIDATING = "Validating"
PREPARED = "Prepared"
SIGNED_OFF = "Signed Off"
SUBMITTED = "Submitted"
APPROVED = "Approved"
REJECTED = "Rejected"
COMPLETE = "Complete"
CANCELLED = "Cancelled"

STATUSES = frozenset(
    {DRAFT, VALIDATING, PREPARED, SIGNED_OFF, SUBMITTED, APPROVED, REJECTED, COMPLETE, CANCELLED}
)

#: Items and details can change only here.
WORKING_STATES = frozenset({DRAFT, VALIDATING, PREPARED})

#: Only these can be deleted (CR-18): a sent delivery is the record of what the client received.
DELETABLE_STATUSES = frozenset({DRAFT, CANCELLED})

#: The delivery has been sent: nothing about what it contains can change any more.
SENT_STATES = frozenset({SUBMITTED, APPROVED, REJECTED, COMPLETE})

#: Statuses that are only left through the map or the audited override.
GUARDED_STATES = SENT_STATES | {CANCELLED}


def _build() -> dict[str, dict[str, str]]:
    table: dict[str, dict[str, str]] = {status: {} for status in STATUSES}
    for source in WORKING_STATES:
        for target in WORKING_STATES - {source}:
            table[source][target] = P.UPDATE
        table[source][CANCELLED] = P.UPDATE
    table[PREPARED][SIGNED_OFF] = P.APPROVE
    table[SIGNED_OFF][PREPARED] = P.APPROVE
    table[SIGNED_OFF][SUBMITTED] = P.SEND
    table[SIGNED_OFF][CANCELLED] = P.APPROVE
    table[SUBMITTED][APPROVED] = P.SEND
    table[SUBMITTED][REJECTED] = P.SEND
    table[APPROVED][COMPLETE] = P.UPDATE
    return table


TRANSITIONS: dict[str, dict[str, str]] = _build()


def can_move(source: str, target: str) -> bool:
    return target in TRANSITIONS.get(source, {})


def required_permission(source: str, target: str) -> str | None:
    """The code the (mapped) move needs, or None when the move is not in the map."""
    return TRANSITIONS.get(source, {}).get(target)


def needs_override(source: str, target: str) -> bool:
    """A move out of a guarded status that the map does not offer: only the audited override."""
    return (
        source in GUARDED_STATES
        and target in STATUSES
        and target != source
        and not can_move(source, target)
    )
