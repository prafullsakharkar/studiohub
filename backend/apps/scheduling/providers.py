"""
What Scheduling offers other apps without being imported (docs/delivery-pipeline/CONTRACTS.md X-05).

Registered at startup (``SchedulingConfig.ready``); consumers ask for them by name through
``apps.core.providers``.

* ``scheduling.project_milestones``: ``for_project(project) -> list[dict]``, the rows Production's
  ``/organizations/projects/{id}/schedule`` route returns (``id``, ``name``, ``date``, ``status``).
  The caller has already checked that the user may see the project.
* ``scheduling.capacity``: the ``CapacitySelector`` (``resource_week``, ``department_week``,
  ``team_week``), for Masterdata's utilization.
"""

from __future__ import annotations

from typing import Any

from apps.core import providers
from apps.scheduling.models import Milestone
from apps.scheduling.selectors.capacity import CapacitySelector

PROJECT_MILESTONES = "scheduling.project_milestones"
CAPACITY = "scheduling.capacity"


class ProjectMilestones:
    def for_project(self, project: Any) -> list[dict[str, Any]]:
        rows = Milestone.objects.filter(project_id=project.pk).order_by("order", "due_date", "name")
        return [
            {
                "id": str(row.pk),
                "name": row.name,
                "date": row.due_date.isoformat(),
                "status": row.status,
            }
            for row in rows
        ]


def register() -> None:
    providers.register(PROJECT_MILESTONES, ProjectMilestones())
    providers.register(CAPACITY, CapacitySelector)
