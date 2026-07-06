from django_filters import BooleanFilter, CharFilter

from apps.core.filters.base import BaseFilterSet
from apps.core.filters.ordering import OrderingFilterMixin
from apps.identity.models.login_history import (
    LoginHistory,
)


class LoginHistoryFilterSet(
    OrderingFilterMixin,
    BaseFilterSet,
):
    """
    FilterSet for LoginHistory.
    """

    user = CharFilter(
        field_name="user__uuid",
    )

    session = CharFilter(
        field_name="session__uuid",
    )

    event = CharFilter(
        field_name="event",
    )

    success = BooleanFilter()

    ip_address = CharFilter(
        field_name="ip_address",
    )

    browser = CharFilter(
        field_name="browser",
        lookup_expr="icontains",
    )

    operating_system = CharFilter(
        field_name="operating_system",
        lookup_expr="icontains",
    )

    class Meta:
        model = LoginHistory

        fields = (
            "user",
            "session",
            "event",
            "success",
            "ip_address",
            "browser",
            "operating_system",
        )
