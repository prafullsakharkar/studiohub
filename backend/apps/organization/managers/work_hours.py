from apps.core.models.managers.base import BaseManager
from apps.organization.querysets.work_hours import (
    WorkHoursQuerySet,
)

WorkHoursManager = BaseManager.from_queryset(
    WorkHoursQuerySet,
)
