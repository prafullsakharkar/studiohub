from django.db.models import Q
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
    Profile,
    SecurityEvent,
    TrustedDevice,
)


class ProfileFilterSet(
    OrderingFilterMixin,
    BaseFilterSet,
):
    """
    FilterSet for Profile.
    """

    user = CharFilter(
        field_name="user",
    )

    first_name = CharFilter(
        field_name="first_name",
        lookup_expr="icontains",
    )

    last_name = CharFilter(
        field_name="last_name",
        lookup_expr="icontains",
    )

    display_name = CharFilter(
        field_name="display_name",
        lookup_expr="icontains",
    )

    timezone = CharFilter(
        field_name="timezone",
    )

    language = CharFilter(
        field_name="language",
    )

    search = CharFilter(
        method="filter_search",
    )

    class Meta:
        model = Profile

        fields = (
            "user",
            "first_name",
            "last_name",
            "display_name",
            "timezone",
            "language",
            "search",
        )

    def filter_search(
        self,
        queryset,
        name,
        value,
    ):
        return queryset.filter(
            Q(first_name__icontains=value)
            | Q(last_name__icontains=value)
            | Q(display_name__icontains=value)
        )


class SecurityEventFilterSet(
    OrderingFilterMixin,
    BaseFilterSet,
):
    """
    FilterSet for SecurityEvent.
    """

    user = CharFilter(
        field_name="user",
    )

    event_type = CharFilter(
        field_name="event_type",
    )

    ip_address = CharFilter(
        field_name="ip_address",
        lookup_expr="icontains",
    )

    is_critical = BooleanFilter()

    start_date = DateFilter(
        field_name="occurred_at",
        lookup_expr="date__gte",
    )

    end_date = DateFilter(
        field_name="occurred_at",
        lookup_expr="date__lte",
    )

    class Meta:
        model = SecurityEvent

        fields = (
            "user",
            "event_type",
            "ip_address",
            "is_critical",
            "start_date",
            "end_date",
        )


class TrustedDeviceFilterSet(
    OrderingFilterMixin,
    BaseFilterSet,
):
    """
    FilterSet for TrustedDevice.
    """

    user = CharFilter(
        field_name="user",
    )

    fingerprint = CharFilter(
        field_name="fingerprint",
        lookup_expr="icontains",
    )

    browser = CharFilter(
        field_name="browser",
        lookup_expr="icontains",
    )

    platform = CharFilter(
        field_name="platform",
    )

    ip_address = CharFilter(
        field_name="ip_address",
        lookup_expr="icontains",
    )

    is_trusted = BooleanFilter()

    class Meta:
        model = TrustedDevice

        fields = (
            "user",
            "fingerprint",
            "browser",
            "platform",
            "ip_address",
            "is_trusted",
        )
