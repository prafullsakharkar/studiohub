from django_filters import rest_framework as filters

from apps.identity.models import UserSession


class UserSessionFilterSet(filters.FilterSet):

    user = filters.UUIDFilter(
        field_name="user__uuid",
    )

    is_current = filters.BooleanFilter()

    is_trusted = filters.BooleanFilter()

    is_revoked = filters.BooleanFilter()

    device_type = filters.CharFilter(
        lookup_expr="iexact",
    )

    browser = filters.CharFilter(
        lookup_expr="icontains",
    )

    operating_system = filters.CharFilter(
        lookup_expr="icontains",
    )

    class Meta:

        model = UserSession

        fields = (
            "user",
            "is_current",
            "is_trusted",
            "is_revoked",
            "device_type",
            "browser",
            "operating_system",
        )
