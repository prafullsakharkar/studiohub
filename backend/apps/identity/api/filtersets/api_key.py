from django_filters import (
    BooleanFilter,
    CharFilter,
    DateTimeFromToRangeFilter,
)

from apps.identity.api.filtersets.base import (
    IdentityFilterSet,
)
from apps.identity.models import APIKey


class APIKeyFilterSet(IdentityFilterSet):
    name = CharFilter(
        field_name="name",
        lookup_expr="icontains",
    )

    prefix = CharFilter(
        field_name="prefix",
        lookup_expr="iexact",
    )

    is_active = BooleanFilter()

    expires_at = DateTimeFromToRangeFilter()

    class Meta:
        model = APIKey

        fields = (
            "name",
            "prefix",
            "is_active",
            "organization",
        )
