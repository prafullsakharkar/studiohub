
from apps.organization.models import Calendar
from apps.organization.querysets.calendar import CalendarQuerySet

from .base import OrganizationBaseSelector


class CalendarSelector(
    OrganizationBaseSelector,
):

    model = Calendar

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ) -> CalendarQuerySet:
        return Calendar.objects.select_related(
            "organization",
        )
