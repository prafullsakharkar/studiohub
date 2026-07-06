from django_filters import BooleanFilter, CharFilter

from apps.core.filters.base import BaseFilterSet
from apps.core.filters.ordering import OrderingFilterMixin
from apps.identity.models.user_session import UserSession


class UserSessionFilterSet(
    OrderingFilterMixin,
    BaseFilterSet,
):
    """
    FilterSet for UserSession.
    """

    user = CharFilter(
        field_name="user__uuid",
    )

    device = CharFilter(
        field_name="device",
        lookup_expr="icontains",
    )

    browser = CharFilter(
        field_name="browser",
        lookup_expr="icontains",
    )

    operating_system = CharFilter(
        field_name="operating_system",
        lookup_expr="icontains",
    )

    ip_address = CharFilter(
        field_name="ip_address",
    )

    is_active = BooleanFilter()

    class Meta:
        model = UserSession

        fields = (
            "user",
            "device",
            "browser",
            "operating_system",
            "ip_address",
            "is_active",
        )
