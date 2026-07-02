from django_filters import CharFilter, ChoiceFilter

from apps.core.filters.base import BaseFilterSet
from apps.core.filters.date import DateRangeFilterMixin
from apps.core.filters.ordering import OrderingFilterMixin
from apps.core.filters.search import SearchFilterMixin
from apps.core.filters.status import StatusFilterMixin
from apps.organization.models import Department


class DepartmentFilterSet(
    SearchFilterMixin,
    StatusFilterMixin,
    DateRangeFilterMixin,
    OrderingFilterMixin,
    BaseFilterSet,
):
    search_fields = (
        "name",
        "code",
    )

    code = CharFilter(
        field_name="code",
        lookup_expr="icontains",
    )

    name = CharFilter(
        field_name="name",
        lookup_expr="icontains",
    )

    department_type = ChoiceFilter(
        choices=Department._meta.get_field("department_type").choices
    )

    parent = CharFilter(
        field_name="parent__uuid",
    )

    manager = CharFilter(
        field_name="manager__uuid",
    )

    class Meta:
        model = Department

        fields = (
            "code",
            "name",
            "department_type",
            "parent",
            "manager",
            "status",
        )
