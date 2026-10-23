"""
Masterdata domain events (docs/masterdata/CONTRACTS.md §7).

Published by the services, dispatched after commit by the core event bus.
Payloads carry field *names* only, never values (SEC-MD-03).
Common payload: ``model`` (label), ``id``, ``code``, ``name``, ``actor_id``.
"""

from __future__ import annotations

from apps.core.events.base import DomainEvent


class MasterdataRecordCreated(DomainEvent):
    """A record was created. Extra payload: ``fields`` (names set)."""


class MasterdataRecordUpdated(DomainEvent):
    """A record changed. Extra payload: ``changed`` (field names)."""


class MasterdataRecordArchived(DomainEvent):
    """A catalog record was archived."""


class MasterdataRecordRestored(DomainEvent):
    """A record was un-archived or un-deleted."""


class MasterdataRecordDeleted(DomainEvent):
    """A record was soft-deleted. Extra payload: ``cascade`` (ids deleted with it)."""


class MasterdataRecordHardDeleted(DomainEvent):
    """A record was permanently removed."""


class ContractTransitioned(DomainEvent):
    """A contract changed lifecycle state. Extra payload: ``transition`` = ``{"from", "to"}``."""


class ContractEndDateAdjusted(DomainEvent):
    """A contract's end date was corrected. Extra payload: ``dates`` = ``{"from", "to"}`` (ISO dates)."""


RECORD_EVENTS = (
    MasterdataRecordCreated,
    MasterdataRecordUpdated,
    MasterdataRecordArchived,
    MasterdataRecordRestored,
    MasterdataRecordDeleted,
    MasterdataRecordHardDeleted,
    ContractTransitioned,
    ContractEndDateAdjusted,
)
