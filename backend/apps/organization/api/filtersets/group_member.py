from django_filters import BooleanFilter, CharFilter

from apps.core.filters.base import BaseFilterSet
from apps.core.filters.ordering import OrderingFilterMixin
from apps.organization.models import GroupMember


class GroupMemberFilterSet(
    OrderingFilterMixin,
    BaseFilterSet,
):
    """
    FilterSet for GroupMember.
    """

    group = CharFilter(
        field_name="group__uuid",
    )

    user = CharFilter(
        field_name="user__uuid",
    )

    is_owner = BooleanFilter(
        field_name="is_owner",
    )

    is_manager = BooleanFilter(
        field_name="is_manager",
    )

    class Meta:
        model = GroupMember

        fields = (
            "group",
            "user",
            "is_owner",
            "is_manager",
        )
