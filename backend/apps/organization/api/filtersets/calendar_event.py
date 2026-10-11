from django_filters import CharFilter, DateFilter

from apps.core.filters.base import BaseFilterSet
from apps.core.filters.ordering import OrderingFilterMixin
from apps.core.filters.search import SearchFilterMixin
from apps.organization.models import CalendarEvent


class CalendarEventFilterSet(
    SearchFilterMixin,
    OrderingFilterMixin,
    BaseFilterSet,
):
    """
    FilterSet for CalendarEvent.
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

    event_type = CharFilter(
        field_name="event_type",
        lookup_expr="iexact",
    )

    date = DateFilter(
        field_name="date",
    )

    class Meta:
        model = CalendarEvent

        fields = (
            "organization",
            "code",
            "name",
            "date",
            "event_type",
        )
