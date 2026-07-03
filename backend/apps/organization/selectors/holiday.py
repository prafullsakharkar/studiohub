from django.db.models import QuerySet

from apps.organization.models import Holiday

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
    ) -> QuerySet:
        return Holiday.objects.select_related(
            "organization",
            "work_calendar",
        )
