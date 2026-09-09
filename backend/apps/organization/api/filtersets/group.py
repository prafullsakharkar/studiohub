from django_filters import BooleanFilter, CharFilter

from apps.core.filters.base import BaseFilterSet
from apps.core.filters.ordering import OrderingFilterMixin
from apps.core.filters.search import SearchFilterMixin
from apps.organization.models import Group


class GroupFilterSet(
    SearchFilterMixin,
    OrderingFilterMixin,
    BaseFilterSet,
):
    """
    FilterSet for Group.
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

    is_system = BooleanFilter(
        field_name="is_system",
    )

    has_users = BooleanFilter(
        method="filter_has_users",
    )

    def filter_has_users(self, queryset, name, value):
        if value:
            return queryset.exclude(users__isnull=True)
        return queryset.filter(users__isnull=True)

    class Meta:
        model = Group

        fields = (
            "organization",
            "code",
            "name",
            "is_system",
            "has_users",
        )
