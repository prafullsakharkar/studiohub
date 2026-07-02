"""
Organization filter set.
"""

from django_filters import CharFilter, ChoiceFilter

from apps.core.filters.date import DateRangeFilterMixin
from apps.core.filters.ordering import OrderingFilterMixin
from apps.core.filters.search import SearchFilterMixin
from apps.core.filters.status import StatusFilterMixin
from apps.organization.models import Organization

from .base import OrganizationBaseFilterSet


class OrganizationFilterSet(
    SearchFilterMixin,
    StatusFilterMixin,
    DateRangeFilterMixin,
    OrderingFilterMixin,
    OrganizationBaseFilterSet,
):
    """
    FilterSet for Organization endpoints.
    """

    code = CharFilter(
        field_name="code",
        lookup_expr="icontains",
    )

    name = CharFilter(
        field_name="name",
        lookup_expr="icontains",
    )

    organization_type = ChoiceFilter(
        choices=Organization._meta.get_field("organization_type").choices
    )

    country = CharFilter(
        field_name="country",
        lookup_expr="iexact",
    )

    language = CharFilter(
        field_name="language",
        lookup_expr="iexact",
    )

    currency = CharFilter(
        field_name="currency",
        lookup_expr="iexact",
    )

    timezone = CharFilter(
        field_name="timezone",
        lookup_expr="iexact",
    )

    search_fields = (
        "name",
        "code",
    )

    class Meta:
        model = Organization

        fields = (
            "code",
            "name",
            "organization_type",
            "status",
            "country",
            "language",
            "currency",
            "timezone",
        )
