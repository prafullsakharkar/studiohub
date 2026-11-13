from django.db import transaction

from apps.core.events import default_event_bus
from apps.production.events.tasks import TaskAssigned
from apps.production.models import Task
from apps.production.services.bulk import BulkOperationService


def _publish_assigned(task, before_id, actor) -> None:
    """
    ``TaskAssigned`` when ``task`` now has an assignee other than ``before_id`` (RP-6, C-RP-24).

    Every route that sets an assignee goes through ``create``, ``update`` or ``assign_task`` below
    (single and bulk), so this is the one place the event is published.
    """
    after_id = task.assignee_id
    if after_id is None or after_id == before_id:
        return
    default_event_bus.publish(
        TaskAssigned(
            task_id=str(task.pk),
            project_id=str(task.project_id),
            from_assignee_id=str(before_id) if before_id else None,
            to_assignee_id=str(after_id),
            actor_id=str(actor.pk) if getattr(actor, "pk", None) else None,
        )
    )


class TaskService(BulkOperationService):
    model = Task

    @classmethod
    @transaction.atomic
    def create(cls, *, user=None, **validated_data):
        task = super().create(user=user, **validated_data)
        _publish_assigned(task, None, user)
        return task

    @classmethod
    @transaction.atomic
    def update(cls, instance, *, user=None, **validated_data):
        before_id = instance.assignee_id
        task = super().update(instance, user=user, **validated_data)
        _publish_assigned(task, before_id, user)
        return task

    @classmethod
    @transaction.atomic
    def assign_task(cls, *, actor, task, assignee=None, team=None):
        """
        Set the assignee and/or team of ``task``.

        The caller has already checked that ``assignee`` is an active member of
        the task's project (``validators.references.require_project_member``).
        """
        before_id = task.assignee_id
        fields = ["updated_at"]
        if assignee is not None:
            task.assignee = assignee
            fields.append("assignee")
        if team is not None:
            task.team = team
            fields.append("team")
        if getattr(actor, "is_authenticated", False):
            task.updated_by = actor
            fields.append("updated_by")
        task.save(update_fields=fields)
        _publish_assigned(task, before_id, actor)
        return task
