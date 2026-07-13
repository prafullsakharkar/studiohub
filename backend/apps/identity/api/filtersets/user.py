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
from apps.identity.models.user import User


class UserFilterSet(
    OrderingFilterMixin,
    BaseFilterSet,
):
    """
    FilterSet for User.
    """

    email = CharFilter(
        field_name="email",
        lookup_expr="icontains",
    )

    is_active = BooleanFilter()

    is_staff = BooleanFilter()

    is_email_verified = BooleanFilter()

    uuid = CharFilter(
        field_name="uuid",
    )

    created_by = CharFilter(
        field_name="created_by__uuid",
    )

    updated_by = CharFilter(
        field_name="updated_by__uuid",
    )

    class Meta:
        model = User

        fields = (
            "email",
            "is_active",
            "is_staff",
            "is_email_verified",
            "uuid",
            "created_by",
            "updated_by",
        )
