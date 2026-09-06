from django_filters import BooleanFilter, CharFilter

from apps.core.filters.base import BaseFilterSet
from apps.core.filters.date import DateRangeFilterMixin
from apps.core.filters.ordering import OrderingFilterMixin
from apps.core.filters.search import SearchFilterMixin
from apps.organization.models import VendorContract


class VendorContractFilterSet(
    SearchFilterMixin,
    DateRangeFilterMixin,
    OrderingFilterMixin,
    BaseFilterSet,
):
    search_fields = (
        "contract_number",
        "title",
    )

    contract_number = CharFilter(
        field_name="contract_number",
        lookup_expr="icontains",
    )

    title = CharFilter(
        field_name="title",
        lookup_expr="icontains",
    )

    type = CharFilter(
        field_name="type",
        lookup_expr="iexact",
    )

    status = CharFilter(
        field_name="status",
        lookup_expr="iexact",
    )

    vendor = CharFilter(
        field_name="vendor__id",
    )

    nda_signed = BooleanFilter(
        field_name="nda_signed",
    )

    class Meta:
        model = VendorContract

        fields = (
            "contract_number",
            "title",
            "type",
            "status",
            "vendor",
            "nda_signed",
        )
