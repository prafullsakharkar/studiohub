from django_filters import BooleanFilter, CharFilter

from apps.core.filters.base import BaseFilterSet
from apps.core.filters.ordering import OrderingFilterMixin
from apps.core.filters.search import SearchFilterMixin
from apps.core.filters.status import StatusFilterMixin
from apps.identity.models.group import Group


class GroupFilterSet(
    SearchFilterMixin,
    OrderingFilterMixin,
    StatusFilterMixin,
    BaseFilterSet,
):
    """
    FilterSet for Group.
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

    is_system = BooleanFilter(
        field_name="is_system",
    )

    class Meta:
        model = Group

        fields = (
            "code",
            "name",
            "status",
            "is_system",
        )
