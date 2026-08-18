from django_filters import CharFilter

from apps.core.filters.base import BaseFilterSet
from apps.core.filters.ordering import OrderingFilterMixin
from apps.organization.models import GroupRole


class GroupRoleFilterSet(
    OrderingFilterMixin,
    BaseFilterSet,
):
    """
    FilterSet for GroupRole.
    """

    group = CharFilter(
        field_name="group__uuid",
    )

    role = CharFilter(
        field_name="role__uuid",
    )

    class Meta:
        model = GroupRole

        fields = (
            "group",
            "role",
        )
