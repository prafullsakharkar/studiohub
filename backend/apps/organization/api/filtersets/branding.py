from django_filters import BooleanFilter, CharFilter

from apps.core.filters.base import BaseFilterSet
from apps.core.filters.ordering import OrderingFilterMixin
from apps.core.filters.search import SearchFilterMixin
from apps.core.filters.status import StatusFilterMixin
from apps.organization.models import Branding


class BrandingFilterSet(
    SearchFilterMixin,
    OrderingFilterMixin,
    StatusFilterMixin,
    BaseFilterSet,
):
    """
    FilterSet for Branding.
    """

    search_fields = (
        "code",
        "name",
        "theme",
    )

    code = CharFilter(
        field_name="code",
        lookup_expr="icontains",
    )

    name = CharFilter(
        field_name="name",
        lookup_expr="icontains",
    )

    organization = CharFilter(
        field_name="organization__uuid",
    )

    theme = CharFilter(
        field_name="theme",
        lookup_expr="icontains",
    )

    primary_color = CharFilter(
        field_name="primary_color",
        lookup_expr="icontains",
    )

    secondary_color = CharFilter(
        field_name="secondary_color",
        lookup_expr="icontains",
    )

    accent_color = CharFilter(
        field_name="accent_color",
        lookup_expr="icontains",
    )

    has_logo = BooleanFilter(
        field_name="logo",
        lookup_expr="isnull",
        exclude=True,
    )

    class Meta:
        model = Branding

        fields = (
            "organization",
            "code",
            "name",
            "theme",
            "primary_color",
            "secondary_color",
            "accent_color",
            "status",
            "has_logo",
        )
