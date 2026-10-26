from django.db import transaction

from apps.production.models import Task
from apps.production.services.bulk import BulkOperationService


class TaskService(BulkOperationService):
    model = Task

    @classmethod
    @transaction.atomic
    def assign_task(cls, *, actor, task, assignee=None, team=None):
        """
        Set the assignee and/or team of ``task``.

        The caller has already checked that ``assignee`` is an active member of
        the task's project (``validators.references.require_project_member``).
        """
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
        return task
