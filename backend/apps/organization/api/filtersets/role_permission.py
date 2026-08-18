from django_filters import BooleanFilter, CharFilter

from apps.core.filters.base import BaseFilterSet
from apps.core.filters.ordering import OrderingFilterMixin
from apps.organization.models import RolePermission


class RolePermissionFilterSet(
    OrderingFilterMixin,
    BaseFilterSet,
):
    """
    FilterSet for RolePermission.
    """

    role = CharFilter(
        field_name="role__uuid",
    )

    permission = CharFilter(
        field_name="permission__uuid",
    )

    granted = BooleanFilter(
        field_name="granted",
    )

    class Meta:
        model = RolePermission

        fields = (
            "role",
            "permission",
            "granted",
        )
