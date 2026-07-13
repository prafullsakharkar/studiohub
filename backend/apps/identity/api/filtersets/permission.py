from django_filters import BooleanFilter, CharFilter

from apps.core.filters.base import BaseFilterSet
from apps.core.filters.ordering import OrderingFilterMixin
from apps.identity.models import Permission


class PermissionFilterSet(
    OrderingFilterMixin,
    BaseFilterSet,
):
    """
    FilterSet for Permission.
    """

    code = CharFilter(
        field_name="code",
        lookup_expr="icontains",
    )

    name = CharFilter(
        field_name="name",
        lookup_expr="icontains",
    )

    content_type = CharFilter(
        field_name="content_type__model",
        lookup_expr="icontains",
    )

    is_active = BooleanFilter()

    class Meta:
        model = Permission

        fields = (
            "code",
            "name",
            "content_type",
            "is_active",
        )
