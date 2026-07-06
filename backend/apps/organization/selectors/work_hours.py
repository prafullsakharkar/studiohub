from django.db.models import QuerySet

from apps.organization.models import WorkHours

from .base import OrganizationBaseSelector


class WorkHoursSelector(
    OrganizationBaseSelector,
):

    model = WorkHours

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ) -> QuerySet:
        return WorkHours.objects.select_related(
            "organization",
            "work_calendar",
        )
