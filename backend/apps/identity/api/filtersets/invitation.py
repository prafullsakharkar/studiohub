from django_filters import filters

from apps.core.filters.base import BaseFilterSet
from apps.identity.models import Invitation


class InvitationFilterSet(
    BaseFilterSet,
):

    organization = filters.UUIDFilter(
        field_name="organization__uuid",
    )

    invited_by = filters.UUIDFilter(
        field_name="invited_by__uuid",
    )

    role = filters.UUIDFilter(
        field_name="role__uuid",
    )

    status = filters.CharFilter()

    email = filters.CharFilter(
        lookup_expr="icontains",
    )

    class Meta:

        model = Invitation

        fields = (
            "organization",
            "invited_by",
            "role",
            "status",
            "email",
        )
