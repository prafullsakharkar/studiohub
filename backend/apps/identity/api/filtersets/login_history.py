from django_filters import (
    CharFilter,
    DateFilter,
)

from apps.core.filters.base import (
    BaseFilterSet,
)
from apps.core.filters.ordering import (
    OrderingFilterMixin,
)
from apps.identity.models import (
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
        field_name="user",
    )

    login_type = CharFilter(
        field_name="login_type",
    )

    status = CharFilter(
        field_name="status",
    )

    ip_address = CharFilter(
        field_name="ip_address",
        lookup_expr="icontains",
    )

    start_date = DateFilter(
        field_name="created_at",
        lookup_expr="date__gte",
    )

    end_date = DateFilter(
        field_name="created_at",
        lookup_expr="date__lte",
    )

    class Meta:
        model = LoginHistory

        fields = (
            "user",
            "login_type",
            "status",
            "ip_address",
            "start_date",
            "end_date",
        )
