from apps.core.api.filtersets.base import BaseFilterSet
from django_filters import (
    BooleanFilter,
    CharFilter,
)

from apps.identity.models import UserSession


class UserSessionFilterSet(
    BaseFilterSet,
):

    status = CharFilter(
        field_name="status",
    )

    browser = CharFilter(
        field_name="browser",
    )

    operating_system = CharFilter(
        field_name="operating_system",
    )

    device_type = CharFilter(
        field_name="device_type",
    )

    organization = CharFilter(
        field_name="organization__uuid",
    )

    office = CharFilter(
        field_name="office__uuid",
    )

    department = CharFilter(
        field_name="department__uuid",
    )

    team = CharFilter(
        field_name="team__uuid",
    )

    user = CharFilter(
        field_name="user__uuid",
    )

    ip_address = CharFilter(
        field_name="ip_address",
    )

    is_current = BooleanFilter()

    is_trusted = BooleanFilter()

    class Meta:
        model = UserSession

        fields = (
            "status",
            "browser",
            "device_type",
            "operating_system",
            "organization",
            "office",
            "department",
            "team",
            "user",
            "ip_address",
            "is_current",
            "is_trusted",
        )
