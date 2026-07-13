from django_filters import BooleanFilter, CharFilter

from apps.core.filters.base import BaseFilterSet
from apps.core.filters.ordering import OrderingFilterMixin
from apps.core.filters.search import SearchFilterMixin
from apps.identity.models import GroupMember


class GroupMemberFilterSet(
    SearchFilterMixin,
    OrderingFilterMixin,
    BaseFilterSet,
):
    """
    FilterSet for GroupMember.
    """

    search_fields = (
        "user__email",
        "user__profile__full_name",
        "group__name",
    )

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
