from django_filters import BooleanFilter, CharFilter

from apps.core.filters.base import BaseFilterSet
from apps.core.filters.ordering import OrderingFilterMixin
from apps.core.filters.search import SearchFilterMixin
from apps.core.filters.status import StatusFilterMixin
from apps.organization.models import (
    OrganizationSettings,
)


class OrganizationSettingsFilterSet(
    SearchFilterMixin,
    OrderingFilterMixin,
    StatusFilterMixin,
    BaseFilterSet,
):
    """
    FilterSet for Organization Settings.
    """

    search_fields = (
        "code",
        "name",
        "timezone",
        "language",
        "currency",
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

    language = CharFilter(
        field_name="language",
        lookup_expr="icontains",
    )

    currency = CharFilter(
        field_name="currency",
        lookup_expr="icontains",
    )

    allow_remote_work = BooleanFilter(
        field_name="allow_remote_work",
    )

    allow_overtime = BooleanFilter(
        field_name="allow_overtime",
    )

    class Meta:
        model = OrganizationSettings

        fields = (
            "organization",
            "code",
            "name",
            "timezone",
            "language",
            "currency",
            "allow_remote_work",
            "allow_overtime",
            "status",
        )
