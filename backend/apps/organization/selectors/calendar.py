from django.db.models import QuerySet

from apps.organization.models import Calendar

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
    ) -> QuerySet:
        return Calendar.objects.select_related(
            "organization",
        )
