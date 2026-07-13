from django_filters import BooleanFilter, CharFilter, ChoiceFilter

from apps.core.filters.base import BaseFilterSet
from apps.core.filters.ordering import OrderingFilterMixin
from apps.identity.choices import (
    RolePriority,
    RoleScope,
    RoleType,
)
from apps.identity.models import (
    Role,
)


class RoleFilterSet(
    OrderingFilterMixin,
    BaseFilterSet,
):
    """
    FilterSet for Role.
    """

    organization = CharFilter(
        field_name="organization__uuid",
    )

    parent = CharFilter(
        field_name="parent__uuid",
    )

    name = CharFilter(
        field_name="name",
        lookup_expr="icontains",
    )

    code = CharFilter(
        field_name="code",
        lookup_expr="icontains",
    )

    role_type = ChoiceFilter(
        choices=RoleType.choices,
    )

    scope = ChoiceFilter(
        choices=RoleScope.choices,
    )

    priority = ChoiceFilter(
        choices=RolePriority.choices,
    )

    is_system = BooleanFilter()

    is_default = BooleanFilter()

    is_active = BooleanFilter()

    class Meta:
        model = Role

        fields = (
            "organization",
            "parent",
            "name",
            "code",
            "role_type",
            "scope",
            "priority",
            "is_system",
            "is_default",
            "is_active",
        )
