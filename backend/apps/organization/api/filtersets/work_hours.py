from django_filters import BooleanFilter, CharFilter, NumberFilter

from apps.core.filters.base import BaseFilterSet
from apps.core.filters.ordering import OrderingFilterMixin
from apps.core.filters.search import SearchFilterMixin
from apps.core.filters.status import StatusFilterMixin
from apps.organization.models.work_hours import WorkHours


class WorkHoursFilterSet(
    SearchFilterMixin,
    OrderingFilterMixin,
    StatusFilterMixin,
    BaseFilterSet,
):
    """
    FilterSet for WorkHours.
    """

    search_fields = (
        "code",
        "name",
    )

    code = CharFilter(
        field_name="code",
        lookup_expr="icontains",
    )

    name = CharFilter(
        field_name="name",
        lookup_expr="icontains",
    )

    organization = CharFilter(
        field_name="organization__uuid",
    )

    work_calendar = CharFilter(
        field_name="work_calendar__uuid",
    )

    day = NumberFilter(
        field_name="day",
    )

    is_working_day = BooleanFilter(
        field_name="is_working_day",
    )

    class Meta:
        model = WorkHours

        fields = (
            "organization",
            "work_calendar",
            "code",
            "name",
            "day",
            "is_working_day",
            "status",
        )
