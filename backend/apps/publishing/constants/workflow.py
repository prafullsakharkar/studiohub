"""
The transition map for published files (docs/publishing/CONTRACTS.md DOM-PUB-02).

One map, one place. Services read it; nothing writes ``PublishedFile.status`` any other way.
Revoked is guarded: leaving it needs ``publishing.status.override`` and a reason.
"""

from __future__ import annotations

from apps.publishing.constants.permissions import PublishPermissions

REGISTERED = "Registered"
DEPRECATED = "Deprecated"
REVOKED = "Revoked"

FILE_STATUSES = frozenset({REGISTERED, DEPRECATED, REVOKED})

FILE_TRANSITIONS: dict[str, frozenset[str]] = {
    REGISTERED: frozenset({DEPRECATED, REVOKED}),
    DEPRECATED: frozenset({REGISTERED, REVOKED}),
    # Out of Revoked only through the override.
    REVOKED: frozenset({REGISTERED, DEPRECATED}),
}

GUARDED_STATES = frozenset({REVOKED})


def can_move(source: str, target: str) -> bool:
    return target in FILE_TRANSITIONS.get(source, frozenset())


def needs_override(source: str, target: str) -> bool:
    """A move out of a guarded state is a correction, not a working move."""
    return source in GUARDED_STATES and target != source


def required_permission(source: str, target: str) -> str:
    """The code a move needs on top of ``publishing.view`` (the override is checked separately)."""
    if needs_override(source, target):
        return PublishPermissions.STATUS_OVERRIDE
    if target == REVOKED:
        return PublishPermissions.REVOKE
    return PublishPermissions.DEPRECATE


# -- export jobs (PublishItem) --------------------------------------------------------------
#
# Working states move along the arrows below; Exported and Cancelled are guarded (final): leaving
# them is a correction that needs ``publishing.status.override`` and a reason. A finished job is
# followed up with ``republish`` (a new job), not reopened.

JOB_PENDING = "Pending"
JOB_VALIDATING = "Validating"
JOB_VALIDATED = "Validated"
JOB_EXPORTING = "Exporting"
JOB_EXPORTED = "Exported"
JOB_FAILED = "Failed"
JOB_CANCELLED = "Cancelled"

JOB_STATUSES = frozenset(
    {
        JOB_PENDING,
        JOB_VALIDATING,
        JOB_VALIDATED,
        JOB_EXPORTING,
        JOB_EXPORTED,
        JOB_FAILED,
        JOB_CANCELLED,
    }
)

JOB_TRANSITIONS: dict[str, frozenset[str]] = {
    JOB_PENDING: frozenset({JOB_VALIDATING, JOB_CANCELLED}),
    JOB_VALIDATING: frozenset({JOB_VALIDATED, JOB_FAILED, JOB_CANCELLED}),
    JOB_VALIDATED: frozenset({JOB_EXPORTING, JOB_PENDING, JOB_CANCELLED}),  # Pending: re-validate
    JOB_EXPORTING: frozenset({JOB_EXPORTED, JOB_FAILED}),
    JOB_FAILED: frozenset({JOB_PENDING, JOB_CANCELLED}),  # Pending: retry
    JOB_EXPORTED: frozenset(),
    JOB_CANCELLED: frozenset(),
}

JOB_GUARDED_STATES = frozenset({JOB_EXPORTED, JOB_CANCELLED})

#: Where an override may send a job out of a guarded state.
JOB_OVERRIDE_TARGETS = frozenset({JOB_PENDING})

#: Where a job's details may be edited (an edit, not a status move). ``republish`` may start anywhere:
#: it creates a new job and changes nothing on the old one.
JOB_EDITABLE_STATES = frozenset({JOB_PENDING, JOB_FAILED})


def can_move_job(source: str, target: str) -> bool:
    return target in JOB_TRANSITIONS.get(source, frozenset())


def job_move_needs_override(source: str, target: str) -> bool:
    """Leaving a guarded state is a correction, not a working move."""
    return source in JOB_GUARDED_STATES and target != source and target in JOB_OVERRIDE_TARGETS
