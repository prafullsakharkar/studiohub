from django_filters import CharFilter

from apps.core.filters.base import BaseFilterSet
from apps.core.filters.ordering import OrderingFilterMixin
from apps.core.filters.search import SearchFilterMixin
from apps.organization.models import Person


class PersonFilterSet(
    SearchFilterMixin,
    OrderingFilterMixin,
    BaseFilterSet,
):
    """
    FilterSet for Person (people roster).
    """

    search_fields = (
        "name",
        "email",
    )

    department = CharFilter(
        field_name="department__uuid",
    )

    department_name = CharFilter(
        field_name="department__name",
        lookup_expr="icontains",
    )

    office = CharFilter(
        field_name="office__uuid",
    )

    role = CharFilter(
        field_name="role__uuid",
    )

    class Meta:
        model = Person

        fields = (
            "department",
            "department_name",
            "office",
            "role",
        )
