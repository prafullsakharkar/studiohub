from collections.abc import Iterable
from typing import Any
from uuid import UUID

from django.db.models import CharField, F, QuerySet, Value
from django.db.models.functions import Coalesce

from apps.production.models import Task
from apps.production.selectors.base import ProductionBaseSelector
from apps.production.selectors.rollups import TaskHoursSelector


class TaskSelector(ProductionBaseSelector):
    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[Task]:
        return TaskHoursSelector.annotate(
            Task.objects.select_related("project", "team", "assignee", "reviewer", "assignee__profile", "reviewer__profile", "task_type")
            .annotate(
                assignee_name_annotated=Coalesce(F("assignee__profile__display_name"), F("assignee__email"), Value(""), output_field=CharField()),
                reviewer_name_annotated=Coalesce(F("reviewer__profile__display_name"), F("reviewer__email"), Value(""), output_field=CharField()),
                project_code_annotated=F("project__code"),
                team_name_annotated=F("team__name"),
            )
            .all()
        )

    @classmethod
    def readable_ids(cls, *, request: Any, task_ids: Iterable[UUID | None]) -> set[UUID]:
        """
        RP-26 (C-RP-61, Q-RP-119): which of ``task_ids`` the caller could open, as the task list scopes
        them (project membership, the external members' narrowing). ``task.view`` is the caller's
        own check. One query, whatever the number of ids.
        """
        ids = {task_id for task_id in task_ids if task_id is not None}
        if not ids:
            return set()
        tasks = cls.scope_by_project_membership(Task.objects.filter(pk__in=ids), request=request)
        return set(tasks.values_list("pk", flat=True))  # pyright: ignore[reportUnknownArgumentType]

