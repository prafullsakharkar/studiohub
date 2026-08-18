from django_filters import BooleanFilter, CharFilter

from apps.core.filters.base import BaseFilterSet
from apps.core.filters.ordering import OrderingFilterMixin
from apps.core.filters.search import SearchFilterMixin
from apps.organization.choices import RoleType, RoleScope, RolePriority
from apps.organization.models import Role


class RoleFilterSet(
    SearchFilterMixin,
    OrderingFilterMixin,
    BaseFilterSet,
):
    """
    FilterSet for Role.
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

    role_type = CharFilter(
        field_name="role_type",
        lookup_expr="exact",
    )

    scope = CharFilter(
        field_name="scope",
        lookup_expr="exact",
    )

    priority = CharFilter(
        field_name="priority",
        lookup_expr="exact",
    )

    parent = CharFilter(
        field_name="parent__uuid",
    )

    is_system = BooleanFilter(
        field_name="is_system",
    )

    is_default = BooleanFilter(
        field_name="is_default",
    )

    is_active = BooleanFilter(
        field_name="is_active",
    )

    has_users = BooleanFilter(
        method="filter_has_users",
    )

    has_permissions = BooleanFilter(
        method="filter_has_permissions",
    )

    def filter_has_users(self, queryset, name, value):
        if value:
            return queryset.exclude(role_users__isnull=True)
        return queryset.filter(role_users__isnull=True)

    def filter_has_permissions(self, queryset, name, value):
        if value:
            return queryset.exclude(role_permissions__isnull=True)
        return queryset.filter(role_permissions__isnull=True)

    class Meta:
        model = Role

        fields = (
            "organization",
            "code",
            "name",
            "role_type",
            "scope",
            "priority",
            "parent",
            "is_system",
            "is_default",
            "is_active",
            "has_users",
            "has_permissions",
        )
