
from apps.organization.models import WorkHours
from apps.organization.querysets import WorkHoursQuerySet

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
    ) -> WorkHoursQuerySet:
        return WorkHours.objects.select_related(
            "organization",
            "work_calendar",
        )
