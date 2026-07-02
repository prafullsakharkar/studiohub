from django_filters import filters

from apps.core.filters.base import BaseFilterSet
from apps.identity.models import OrganizationMembership


class MembershipFilterSet(BaseFilterSet):
    """
    Filters for Organization Membership.
    """

    organization = filters.UUIDFilter(
        field_name="organization__uuid",
    )

    department = filters.UUIDFilter(
        field_name="department__uuid",
    )

    team = filters.UUIDFilter(
        field_name="team__uuid",
    )

    office = filters.UUIDFilter(
        field_name="office__uuid",
    )

    role = filters.UUIDFilter(
        field_name="role__uuid",
    )

    user = filters.UUIDFilter(
        field_name="user__uuid",
    )

    status = filters.CharFilter()

    employment_type = filters.CharFilter()

    is_primary = filters.BooleanFilter()

    class Meta:
        model = OrganizationMembership

        fields = (
            "organization",
            "department",
            "team",
            "office",
            "role",
            "user",
            "status",
            "employment_type",
            "is_primary",
        )
