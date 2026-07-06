from apps.core.models.managers.base import BaseManager
from apps.organization.querysets.calendar import (
    CalendarQuerySet,
)

CalendarManager = BaseManager.from_queryset(
    CalendarQuerySet,
)
