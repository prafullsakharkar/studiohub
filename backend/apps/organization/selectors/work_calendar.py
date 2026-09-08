
from apps.organization.models import (
    WorkCalendar,
)
from apps.organization.querysets import WorkCalendarQuerySet

from .base import (
    OrganizationBaseSelector,
)


class WorkCalendarSelector(
    OrganizationBaseSelector,
):

    model = WorkCalendar

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ) -> WorkCalendarQuerySet:
        return WorkCalendar.objects.prefetch_related(
            "holidays",
        )
