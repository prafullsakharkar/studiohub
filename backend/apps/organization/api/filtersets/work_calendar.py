from django_filters import BooleanFilter, CharFilter

from apps.core.filters.base import BaseFilterSet
from apps.core.filters.ordering import OrderingFilterMixin
from apps.core.filters.search import SearchFilterMixin
from apps.core.filters.status import StatusFilterMixin
from apps.organization.models.work_calendar import WorkCalendar


class WorkCalendarFilterSet(
    SearchFilterMixin,
    OrderingFilterMixin,
    StatusFilterMixin,
    BaseFilterSet,
):
    """
    FilterSet for WorkCalendar.
    """

    search_fields = (
        "code",
        "name",
        "timezone",
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

    timezone = CharFilter(
        field_name="timezone",
        lookup_expr="icontains",
    )

    is_default = BooleanFilter(
        field_name="is_default",
    )

    class Meta:
        model = WorkCalendar

        fields = (
            "organization",
            "code",
            "name",
            "timezone",
            "is_default",
            "status",
        )
