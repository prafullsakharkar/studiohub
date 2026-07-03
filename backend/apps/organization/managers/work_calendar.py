from apps.core.models.managers.base import BaseManager
from apps.organization.querysets.work_calendar import (
    WorkCalendarQuerySet,
)

WorkCalendarManager = BaseManager.from_queryset(
    WorkCalendarQuerySet,
)
