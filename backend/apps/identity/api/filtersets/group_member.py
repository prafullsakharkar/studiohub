from django_filters import BooleanFilter, CharFilter

from apps.core.filters.base import BaseFilterSet
from apps.core.filters.ordering import OrderingFilterMixin
from apps.core.filters.status import StatusFilterMixin
from apps.identity.models.group_member import (
    GroupMember,
)


class GroupMemberFilterSet(
    OrderingFilterMixin,
    StatusFilterMixin,
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

    is_owner = BooleanFilter()

    is_manager = BooleanFilter()

    class Meta:
        model = GroupMember

        fields = (
            "group",
            "user",
            "status",
            "is_owner",
            "is_manager",
        )
