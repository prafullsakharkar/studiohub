from django_filters import BooleanFilter, CharFilter, DateFilter

from apps.core.filters.base import BaseFilterSet
from apps.core.filters.ordering import OrderingFilterMixin
from apps.core.filters.search import SearchFilterMixin
from apps.core.filters.status import StatusFilterMixin
from apps.organization.models import Holiday


class HolidayFilterSet(
    SearchFilterMixin,
    OrderingFilterMixin,
    StatusFilterMixin,
    BaseFilterSet,
):
    """
    FilterSet for Holiday.
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

    date = DateFilter(
        field_name="date",
    )

    holiday_type = CharFilter(
        field_name="holiday_type",
    )

    is_paid = BooleanFilter(
        field_name="is_paid",
    )

    is_recurring = BooleanFilter(
        field_name="is_recurring",
    )

    class Meta:
        model = Holiday

        fields = (
            "organization",
            "work_calendar",
            "code",
            "name",
            "date",
            "holiday_type",
            "is_paid",
            "is_recurring",
            "status",
        )
