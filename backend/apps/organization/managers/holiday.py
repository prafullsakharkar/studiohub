from apps.core.models.managers.base import BaseManager
from apps.organization.querysets.holiday import HolidayQuerySet

HolidayManager = BaseManager.from_queryset(
    HolidayQuerySet,
)
