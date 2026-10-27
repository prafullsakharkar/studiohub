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
