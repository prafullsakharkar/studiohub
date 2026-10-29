"""
Status workflow: which status may follow which, and what it takes.

One table per entity, in this file only. The rule of thumb: working states move
freely among themselves; the states that mean something are fenced.

* **Approved** is entered from the review state only and left only to Archived.
* **Archived** is left only by the restore bookkeeping (``enforce=False``).
* **Closed** (review) and **Approved** (timelog) are final; a published
  version's status is frozen.
* A timelog follows Draft -> Submitted -> Approved or Rejected.

Corrections of those fences need ``production.status.override`` and a reason
(shot, task, version, review; never a timelog: an approved timelog is corrected
with an adjustment entry). Separation of duties is in ``SEPARATION``.

A current status missing from a table (legacy data) may move to any valid
status, so a bad row is never trapped.
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
APPROVED = "Approved"

#: entities whose fences ``production.status.override`` may cross
OVERRIDABLE = frozenset({SHOT, TASK, VERSION, REVIEW})


def _working(
    states: tuple[str, ...], *, review_only: str, approved: str
) -> dict[str, frozenset[str]]:
    """Working states move freely; ``approved`` comes from ``review_only`` and leads to Archived."""
    graph = {
        state: frozenset(
            (set(states) - {state}) | {ARCHIVED} | ({approved} if state == review_only else set())
        )
        for state in states
    }
    graph[approved] = frozenset({ARCHIVED})
    graph[ARCHIVED] = frozenset()
    return graph


_SHOT_WORKING = ("Not Started", "In Progress", "Pending Review", "Retake", "On Hold")
_PRODUCTION_WORKING = ("Not Started", "In Progress", "Pending Review", "Retake")

TRANSITIONS: dict[str, dict[str, frozenset[str]]] = {
    SHOT: _working(_SHOT_WORKING, review_only="Pending Review", approved=APPROVED),
    TASK: _working(_PRODUCTION_WORKING, review_only="Pending Review", approved=APPROVED),
    VERSION: _working(_PRODUCTION_WORKING, review_only="Pending Review", approved=APPROVED),
    REVIEW: {
        "Pending Review": frozenset({"Submitted", "In Review", "Closed"}),
        "Submitted": frozenset({"In Review", "Closed"}),
        "In Review": frozenset({"Approved", "Rejected", "Changes Requested", "Retake", "Closed"}),
        "Changes Requested": frozenset({"Submitted", "In Review", "Closed"}),
        "Retake": frozenset({"Submitted", "In Review", "Closed"}),
        "Rejected": frozenset({"Submitted", "Closed"}),
        "Approved": frozenset({"Closed"}),
        "Closed": frozenset(),
    },
    TIMELOG: {
        "Draft": frozenset({"Submitted"}),
        "Submitted": frozenset({"Approved", "Rejected", "Draft"}),
        "Rejected": frozenset({"Submitted", "Draft"}),
        "Approved": frozenset(),
    },
}

#: entity -> status -> code needed to move to it
ENTERING: dict[str, dict[str, str]] = {
    SHOT: {APPROVED: ShotPermissions.APPROVE},
    VERSION: {APPROVED: VersionPermissions.PUBLISH},
    REVIEW: dict.fromkeys(
        ("Approved", "Rejected", "Changes Requested", "Retake"), ReviewPermissions.APPROVE
    ),
    TIMELOG: dict.fromkeys(("Approved", "Rejected"), TimelogPermissions.APPROVE),
}
#: entity -> status -> code needed to move away from it
LEAVING: dict[str, dict[str, str]] = {
    SHOT: {APPROVED: ShotPermissions.APPROVE},
    VERSION: {APPROVED: VersionPermissions.PUBLISH},
}

#: entity -> target statuses that approve work; the actor must not have produced it
SEPARATION: dict[str, frozenset[str]] = {
    TIMELOG: frozenset({"Approved", "Rejected"}),
    REVIEW: frozenset({"Approved"}),
    VERSION: frozenset({APPROVED}),
}

#: entities whose status is frozen once published (``is_published``)
FROZEN_WHEN_PUBLISHED = frozenset({VERSION})


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


def needs_separation(entity: str, to_status: str) -> bool:
    return to_status in SEPARATION.get(entity, frozenset())
