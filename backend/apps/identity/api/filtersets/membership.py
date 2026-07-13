from django_filters import (
    BooleanFilter,
    CharFilter,
    ChoiceFilter,
)

from apps.core.filters.base import BaseFilterSet
from apps.core.filters.ordering import OrderingFilterMixin
from apps.identity.choices import (
    EmploymentType,
    MembershipStatus,
)
from apps.identity.models import (
    OrganizationMembership,
)


class MembershipFilterSet(
    OrderingFilterMixin,
    BaseFilterSet,
):
    """
    FilterSet for OrganizationMembership.
    """

    user = CharFilter(
        field_name="user__uuid",
    )

    organization = CharFilter(
        field_name="organization__uuid",
    )

    department = CharFilter(
        field_name="department__uuid",
    )

    team = CharFilter(
        field_name="team__uuid",
    )

    office = CharFilter(
        field_name="office__uuid",
    )

    role = CharFilter(
        field_name="role__uuid",
    )

    employee_id = CharFilter(
        field_name="employee_id",
        lookup_expr="icontains",
    )

    employment_type = ChoiceFilter(
        choices=EmploymentType.choices,
    )

    status = ChoiceFilter(
        choices=MembershipStatus.choices,
    )

    is_primary = BooleanFilter()

    class Meta:
        model = OrganizationMembership

        fields = (
            "user",
            "organization",
            "department",
            "team",
            "office",
            "role",
            "employee_id",
            "employment_type",
            "status",
            "is_primary",
        )
