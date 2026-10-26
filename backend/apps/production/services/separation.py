"""
Who produced the work being approved.

Separation of duties: an approver must not be among the people who produced what
they approve. ``producers`` collects them from the record itself and the work it
points at (for a review: who submitted it, and who made what it reviews). It leans on facts that cannot be rewritten after the fact: who created
the record, the artist/person it names, and the task's assignee both now and at any
earlier time (read from the change log), so handing a task to someone else before
approving does not clear the approver.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from apps.production.constants import workflow


def _uuid(value: Any) -> UUID | None:
    try:
        return UUID(str(value))
    except ValueError:
        return None


def _ever_assigned(task: Any) -> set[UUID]:
    """Every user who was the task's assignee, per the change log."""
    from apps.audit.models import ChangeLog

    users: set[UUID] = set()
    rows = ChangeLog.objects.filter(target_type="Task", target_id=str(task.pk)).values_list(
        "before_values", "after_values"
    )
    for before, after in rows:
        for side in (before or {}, after or {}):
            user_id = _uuid(side.get("assignee_id"))
            if user_id:
                users.add(user_id)
    return users


def _task_producers(task: Any) -> set[UUID]:
    if task is None:
        return set()
    users = _ever_assigned(task)
    if task.assignee_id:
        users.add(task.assignee_id)
    return users


def _submitters(review: Any) -> set[UUID]:
    """Who sent the review in for review: the actors that moved it to Submitted."""
    from apps.production.models import StatusHistory

    return set(
        StatusHistory.objects.filter(
            entity_type="Review", entity_id=review.pk, to_status="Submitted", actor__isnull=False
        ).values_list("actor_id", flat=True)
    )


def _review_subject_producers(review: Any) -> set[UUID]:
    from apps.production.models import Shot, Task, Version

    subject_id = _uuid(review.entity_id)
    if subject_id is None:
        return set()
    kind = (review.entity_type or "").lower()
    if kind == "version":
        version = Version.objects.filter(pk=subject_id, project_id=review.project_id).first()
        return producers(version) if version else set()
    if kind == "shot":
        shot = Shot.objects.filter(pk=subject_id, project_id=review.project_id).first()
        return {shot.assigned_artist_id} if shot and shot.assigned_artist_id else set()
    if kind == "task":
        return _task_producers(
            Task.objects.filter(pk=subject_id, project_id=review.project_id).first()
        )
    return set()


def producers(entity: Any) -> set[UUID]:
    """User ids that produced ``entity`` (a timelog, review or version)."""
    key = workflow.ENTITY_FOR_MODEL.get(type(entity).__name__)
    users: set[Any] = set()
    if key == workflow.TIMELOG:
        users = {entity.person_id, entity.created_by_id}
    elif key == workflow.VERSION:
        users = {entity.artist_id, entity.created_by_id} | _task_producers(entity.task)
    elif key == workflow.REVIEW:
        # Not ``created_by``/``lead_reviewer``: the reviewer who sets a session up is
        # the one who approves it. The producers are those who submitted work for it
        # and those who made the work reviewed.
        users = _submitters(entity) | _review_subject_producers(entity)
    return {user for user in users if user is not None}
