from django_filters import BooleanFilter, CharFilter

from apps.core.filters.base import BaseFilterSet
from apps.core.filters.date import DateRangeFilterMixin
from apps.core.filters.ordering import OrderingFilterMixin
from apps.core.filters.search import SearchFilterMixin
from apps.organization.models import ClientContact


class ClientContactFilterSet(
    SearchFilterMixin,
    DateRangeFilterMixin,
    OrderingFilterMixin,
    BaseFilterSet,
):
    search_fields = (
        "name",
        "email",
        "role",
    )

    name = CharFilter(
        field_name="name",
        lookup_expr="icontains",
    )

    email = CharFilter(
        field_name="email",
        lookup_expr="icontains",
    )

    role = CharFilter(
        field_name="role",
        lookup_expr="icontains",
    )

    client = CharFilter(
        field_name="client__id",
    )

    is_primary = BooleanFilter(
        field_name="is_primary",
    )

    portal_access = BooleanFilter(
        field_name="portal_access",
    )

    class Meta:
        model = ClientContact

        fields = (
            "name",
            "email",
            "role",
            "client",
            "is_primary",
            "portal_access",
        )
