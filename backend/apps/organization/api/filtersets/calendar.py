from django_filters import BooleanFilter, CharFilter

from apps.core.filters.base import BaseFilterSet
from apps.core.filters.ordering import OrderingFilterMixin
from apps.core.filters.search import SearchFilterMixin
from apps.core.filters.status import StatusFilterMixin
from apps.organization.models.calendar import Calendar


class CalendarFilterSet(
    SearchFilterMixin,
    OrderingFilterMixin,
    StatusFilterMixin,
    BaseFilterSet,
):
    """
    FilterSet for Calendar.
    """

    search_fields = (
        "code",
        "name",
        "description",
    )

    code = CharFilter(
        field_name="code",
        lookup_expr="icontains",
    )

    name = CharFilter(
        field_name="name",
        lookup_expr="icontains",
    )

    description = CharFilter(
        field_name="description",
        lookup_expr="icontains",
    )

    organization = CharFilter(
        field_name="organization__uuid",
    )

    is_default = BooleanFilter(
        field_name="is_default",
    )

    is_public = BooleanFilter(
        field_name="is_public",
    )

    class Meta:
        model = Calendar

        fields = (
            "organization",
            "code",
            "name",
            "description",
            "is_default",
            "is_public",
            "status",
        )
