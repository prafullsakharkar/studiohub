from django_filters import BooleanFilter, CharFilter

from apps.core.filters.base import BaseFilterSet
from apps.core.filters.ordering import OrderingFilterMixin
from apps.core.filters.search import SearchFilterMixin
from apps.core.filters.status import StatusFilterMixin
from apps.organization.models.office import Office


class OfficeFilterSet(
    SearchFilterMixin,
    OrderingFilterMixin,
    StatusFilterMixin,
    BaseFilterSet,
):
    """
    FilterSet for Office.
    """

    search_fields = (
        "code",
        "name",
        "city",
        "country",
    )

    code = CharFilter(
        field_name="code",
        lookup_expr="icontains",
    )

    name = CharFilter(
        field_name="name",
        lookup_expr="icontains",
    )

    city = CharFilter(
        field_name="city",
        lookup_expr="icontains",
    )

    state = CharFilter(
        field_name="state",
        lookup_expr="icontains",
    )

    country = CharFilter(
        field_name="country",
        lookup_expr="icontains",
    )

    timezone = CharFilter(
        field_name="timezone",
    )

    manager = CharFilter(
        field_name="manager__uuid",
    )

    organization = CharFilter(
        field_name="organization__uuid",
    )

    is_headquarters = BooleanFilter(
        field_name="is_headquarters",
    )

    class Meta:
        model = Office

        fields = (
            "organization",
            "code",
            "name",
            "city",
            "state",
            "country",
            "timezone",
            "manager",
            "status",
            "is_headquarters",
        )
