
from apps.organization.models import Holiday
from apps.organization.querysets.holiday import HolidayQuerySet

from .base import OrganizationBaseSelector


class HolidaySelector(
    OrganizationBaseSelector,
):

    model = Holiday

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ) -> HolidayQuerySet:
        return Holiday.objects.select_related(
            "organization",
            "work_calendar",
        )
