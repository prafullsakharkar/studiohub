from django_filters import (
    BooleanFilter,
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
    LoginAttempt,
)


class LoginAttemptFilterSet(
    OrderingFilterMixin,
    BaseFilterSet,
):
    """
    FilterSet for LoginAttempt.
    """

    user = CharFilter(
        field_name="user",
    )

    username = CharFilter(
        field_name="username",
        lookup_expr="icontains",
    )

    success = BooleanFilter()

    ip_address = CharFilter(
        field_name="ip_address",
        lookup_expr="icontains",
    )

    reason = CharFilter(
        field_name="reason",
        lookup_expr="icontains",
    )

    start_date = DateFilter(
        field_name="attempted_at",
        lookup_expr="date__gte",
    )

    end_date = DateFilter(
        field_name="attempted_at",
        lookup_expr="date__lte",
    )

    class Meta:
        model = LoginAttempt

        fields = (
            "user",
            "username",
            "success",
            "ip_address",
            "reason",
            "start_date",
            "end_date",
        )
