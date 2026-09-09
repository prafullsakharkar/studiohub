from django_filters import CharFilter

from apps.core.filters.base import BaseFilterSet
from apps.core.filters.ordering import OrderingFilterMixin
from apps.organization.models import UserRole


class UserRoleFilterSet(
    OrderingFilterMixin,
    BaseFilterSet,
):
    """
    FilterSet for UserRole.
    """

    user = CharFilter(
        field_name="user__uuid",
    )

    role = CharFilter(
        field_name="role__uuid",
    )

    class Meta:
        model = UserRole

        fields = (
            "user",
            "role",
        )
