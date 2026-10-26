"""
Status workflow: which status may follow which, and what it takes.

One place for the rules ``StatusService.transition_status`` enforces. The maps
are the MVP of the plan (fixed, in code); a status that is not a key of an
entity's map is not a valid status of that entity. A current status that is
missing from the map (legacy data) may move to any valid status, so a bad row
is never trapped.

Permissions: moving a shot to or from Approved needs ``shot.approve`` and so
on, on top of the ``*.update`` code of the request. Separation of duties
(an approver who is also the artist) is not enforced yet.
"""

from __future__ import annotations

from apps.production.constants.permissions import (
    ReviewPermissions,
    ShotPermissions,
    TimelogPermissions,
    VersionPermissions,
)

SHOT = "shot"
TASK = "task"
VERSION = "version"
REVIEW = "review"
TIMELOG = "timelog"

#: model name -> workflow entity key
ENTITY_FOR_MODEL = {
    "Shot": SHOT,
    "Task": TASK,
    "Version": VERSION,
    "Review": REVIEW,
    "Timelog": TIMELOG,
}

ARCHIVED = "Archived"

_SHOT_LIVE = ("Not Started", "In Progress", "Pending Review", "Approved", "Retake", "On Hold")
_PRODUCTION_LIVE = ("Not Started", "In Progress", "Pending Review", "Approved", "Retake")
_REVIEW_OPEN = (
    "Pending Review",
    "Submitted",
    "In Review",
    "Changes Requested",
    "Retake",
    "Rejected",
    "Approved",
)


def _any_of(live: tuple[str, ...], *, restore_to: tuple[str, ...]) -> dict[str, frozenset[str]]:
    """Every live status may move to every other live status and to Archived."""
    graph = {status: frozenset((set(live) - {status}) | {ARCHIVED}) for status in live}
    graph[ARCHIVED] = frozenset(restore_to)
    return graph


TRANSITIONS: dict[str, dict[str, frozenset[str]]] = {
    SHOT: {
        "Not Started": frozenset({"In Progress", "On Hold", "Approved", ARCHIVED}),
        "In Progress": frozenset(
            {"Not Started", "Pending Review", "On Hold", "Approved", "Retake", ARCHIVED}
        ),
        "Pending Review": frozenset({"In Progress", "Approved", "Retake", "On Hold", ARCHIVED}),
        "Approved": frozenset({"In Progress", "Retake", "On Hold", ARCHIVED}),
        "Retake": frozenset({"In Progress", "Pending Review", "On Hold", "Approved", ARCHIVED}),
        "On Hold": frozenset({"Not Started", "In Progress", "Pending Review", ARCHIVED}),
        ARCHIVED: frozenset({"Not Started", "In Progress"}),
    },
    TASK: _any_of(_PRODUCTION_LIVE, restore_to=("Not Started", "In Progress")),
    VERSION: _any_of(_PRODUCTION_LIVE, restore_to=("Not Started", "In Progress")),
    REVIEW: {
        **{
            status: frozenset((set(_REVIEW_OPEN) - {status}) | {"Closed", ARCHIVED})
            for status in _REVIEW_OPEN
        },
        "Closed": frozenset(),
        ARCHIVED: frozenset({"Pending Review"}),
    },
    TIMELOG: {
        "Draft": frozenset({"Submitted"}),
        "Submitted": frozenset({"Approved", "Rejected", "Draft"}),
        "Rejected": frozenset({"Submitted", "Draft"}),
        "Approved": frozenset(),
    },
}

#: entity -> status -> code needed to move to it (or, for ``LEAVING``, away from it)
ENTERING: dict[str, dict[str, str]] = {
    SHOT: {"Approved": ShotPermissions.APPROVE},
    VERSION: {"Approved": VersionPermissions.PUBLISH},
    REVIEW: dict.fromkeys(
        ("Approved", "Rejected", "Changes Requested", "Retake"), ReviewPermissions.APPROVE
    ),
    TIMELOG: dict.fromkeys(("Approved", "Rejected"), TimelogPermissions.APPROVE),
}
LEAVING: dict[str, dict[str, str]] = {
    SHOT: {"Approved": ShotPermissions.APPROVE},
    VERSION: {"Approved": VersionPermissions.PUBLISH},
}


def valid_statuses(entity: str) -> frozenset[str]:
    return frozenset(TRANSITIONS[entity])


def is_allowed(entity: str, from_status: str, to_status: str) -> bool:
    """Whether ``from_status`` -> ``to_status`` is a legal move for ``entity``."""
    graph = TRANSITIONS[entity]
    if to_status not in graph:
        return False
    if from_status not in graph:
        return True
    return to_status in graph[from_status]


def required_permissions(entity: str, from_status: str | None, to_status: str) -> tuple[str, ...]:
    """Codes, beyond the request's own, needed to move ``from_status`` -> ``to_status``."""
    codes: list[str] = []
    entering = ENTERING.get(entity, {}).get(to_status)
    if entering:
        codes.append(entering)
    leaving = LEAVING.get(entity, {}).get(from_status or "")
    if leaving and leaving not in codes:
        codes.append(leaving)
    return tuple(codes)
