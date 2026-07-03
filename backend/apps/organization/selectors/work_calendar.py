from django.db.models import QuerySet

from apps.organization.models import (
    WorkCalendar,
)

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
    ) -> QuerySet:
        return WorkCalendar.objects.prefetch_related(
            "holidays",
        )
