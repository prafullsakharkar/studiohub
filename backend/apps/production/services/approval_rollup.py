"""
Approval roll-up (review pipeline RP-3, C-RP-15; Q-RP-5, Q-RP-15 to Q-RP-18 = A).

A version that moves to ``Approved`` approves its task, when the version's project has
``approve_task_on_version_approval`` on. The roll-up runs after the approval has committed
(``ApprovalRollupHandler`` on ``StatusChanged``), in a transaction of its own, so it can never
undo or block the approval itself.

The rule decides, not the approver's own task rights: the approver held ``version.publish`` and
passed separation of duties for the version, and the version's task is on the same shot or asset.
The task's history names the approver and the version.
"""

from __future__ import annotations

from typing import Any

from django.contrib.auth import get_user_model
from django.db import transaction

from apps.production.constants import workflow
from apps.production.models import Task, Version
from apps.production.services.status import StatusService

#: task statuses the roll-up leaves alone (Q-RP-15 = A: every other, working, state moves)
UNTOUCHED = frozenset({workflow.APPROVED, workflow.ARCHIVED})


def rollup_reason(version: Version) -> str:
    return f"Version {version.code} approved"


class ApprovalRollupService:
    @classmethod
    @transaction.atomic
    def roll_up(cls, *, version_id: str, actor_id: str | None) -> Task | None:
        """
        Approve the task of version ``version_id`` if the project's rule says so; return the task
        when it moved, else ``None``. Re-reads everything, so a second run changes nothing.
        """
        version = Version.objects.select_related("project").filter(pk=version_id).first()
        if version is None or version.status != workflow.APPROVED or not version.task_id:
            return None
        if not version.project.approve_task_on_version_approval:
            return None
        task = Task.objects.select_for_update().filter(pk=version.task_id).first()
        if task is None or task.status in UNTOUCHED:
            return None
        actor: Any = get_user_model().objects.filter(pk=actor_id).first() if actor_id else None
        # enforce=False: the task moves from any working state (Q-RP-15), not only from
        # Pending Review; the history row is written as for every other move.
        StatusService.transition_status(
            actor=actor,
            entity=task,
            to_status=workflow.APPROVED,
            reason=rollup_reason(version),
            enforce=False,
        )
        return task
