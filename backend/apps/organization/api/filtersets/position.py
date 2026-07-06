from django_filters import BooleanFilter, CharFilter, NumberFilter

from apps.core.filters.base import BaseFilterSet
from apps.core.filters.ordering import OrderingFilterMixin
from apps.core.filters.search import SearchFilterMixin
from apps.core.filters.status import StatusFilterMixin
from apps.organization.models.position import Position


class PositionFilterSet(
    SearchFilterMixin,
    OrderingFilterMixin,
    StatusFilterMixin,
    BaseFilterSet,
):
    """
    FilterSet for Position.
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

    department = CharFilter(
        field_name="department__uuid",
    )

    parent = CharFilter(
        field_name="parent__uuid",
    )

    level = NumberFilter(
        field_name="level",
    )

    is_managerial = BooleanFilter(
        field_name="is_managerial",
    )

    class Meta:
        model = Position

        fields = (
            "organization",
            "department",
            "parent",
            "code",
            "name",
            "level",
            "is_managerial",
            "status",
        )
