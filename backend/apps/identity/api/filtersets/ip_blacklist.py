from datetime import timezone

from django.db import models
from django_filters import (
    BooleanFilter,
    CharFilter,
)

from apps.core.filters.base import (
    BaseFilterSet,
)
from apps.core.filters.ordering import (
    OrderingFilterMixin,
)
from apps.identity.models import IPBlacklist


class IPBlacklistFilterSet(
    OrderingFilterMixin,
    BaseFilterSet,
):
    """
    FilterSet for IPBlacklist.
    """

    ip_address = CharFilter(
        field_name="ip_address",
        lookup_expr="icontains",
    )

    network = CharFilter(
        field_name="network",
        lookup_expr="icontains",
    )

    is_active = BooleanFilter()

    expired = BooleanFilter(method="filter_expired")

    reason = CharFilter(
        field_name="reason",
        lookup_expr="icontains",
    )

    description = CharFilter(
        field_name="description",
        lookup_expr="icontains",
    )

    uuid = CharFilter(
        field_name="id",
    )

    created_by = CharFilter(
        field_name="created_by__id",
    )

    updated_by = CharFilter(
        field_name="updated_by__id",
    )

    class Meta:
        model = IPBlacklist

        fields = (
            "ip_address",
            "network",
            "is_active",
            "expired",
            "reason",
            "description",
            "uuid",
            "created_by",
            "updated_by",
        )

    def filter_expired(self, queryset, name, value):
        if value:
            return queryset.filter(
                models.Q(expires_at__isnull=False)
                & models.Q(expires_at__lte=timezone.now())
            )
        return queryset.filter(
            models.Q(expires_at__isnull=True)
            | models.Q(expires_at__gt=timezone.now())
        )
