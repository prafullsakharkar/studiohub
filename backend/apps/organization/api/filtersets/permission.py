from django_filters import BooleanFilter, CharFilter

from apps.core.filters.base import BaseFilterSet
from apps.core.filters.ordering import OrderingFilterMixin
from apps.core.filters.search import SearchFilterMixin
from apps.organization.models import Permission


class PermissionFilterSet(
    SearchFilterMixin,
    OrderingFilterMixin,
    BaseFilterSet,
):
    """
    FilterSet for Permission.
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

    module = CharFilter(
        field_name="module",
        lookup_expr="exact",
    )

    action = CharFilter(
        field_name="action",
        lookup_expr="exact",
    )

    category = CharFilter(
        field_name="category",
        lookup_expr="exact",
    )

    is_system = BooleanFilter(
        field_name="is_system",
    )

    is_active = BooleanFilter(
        field_name="is_active",
    )

    has_roles = BooleanFilter(
        method="filter_has_roles",
    )

    def filter_has_roles(self, queryset, name, value):
        if value:
            return queryset.exclude(role_permissions__isnull=True)
        return queryset.filter(role_permissions__isnull=True)

    class Meta:
        model = Permission

        fields = (
            "organization",
            "code",
            "name",
            "module",
            "action",
            "category",
            "is_system",
            "is_active",
            "has_roles",
        )
