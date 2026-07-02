from django_filters import CharFilter, NumberFilter

from apps.core.filters.base import BaseFilterSet
from apps.core.filters.ordering import OrderingFilterMixin
from apps.core.filters.search import SearchFilterMixin
from apps.core.filters.status import StatusFilterMixin
from apps.organization.models.team import Team


class TeamFilterSet(
    SearchFilterMixin,
    OrderingFilterMixin,
    StatusFilterMixin,
    BaseFilterSet,
):
    """
    FilterSet for Team entity.
    """

    # -----------------------------
    # Search configuration
    # -----------------------------
    search_fields = (
        "code",
        "name",
    )

    # -----------------------------
    # Filters
    # -----------------------------

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

    lead = CharFilter(
        field_name="lead__uuid",
    )

    capacity_min = NumberFilter(
        field_name="capacity",
        lookup_expr="gte",
    )

    capacity_max = NumberFilter(
        field_name="capacity",
        lookup_expr="lte",
    )

    # -----------------------------
    # Meta
    # -----------------------------
    class Meta:
        model = Team

        fields = (
            "code",
            "name",
            "organization",
            "department",
            "lead",
            "status",
        )
