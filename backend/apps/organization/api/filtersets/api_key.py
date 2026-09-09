from django_filters import BooleanFilter, CharFilter

from apps.core.filters.base import BaseFilterSet
from apps.core.filters.ordering import OrderingFilterMixin
from apps.core.filters.search import SearchFilterMixin
from apps.organization.models import APIKey


class APIKeyFilterSet(
    SearchFilterMixin,
    OrderingFilterMixin,
    BaseFilterSet,
):
    """
    FilterSet for APIKey.
    """

    search_fields = (
        "code",
        "name",
        "prefix",
    )

    name = CharFilter(
        field_name="name",
        lookup_expr="icontains",
    )

    prefix = CharFilter(
        field_name="prefix",
        lookup_expr="startswith",
    )

    organization = CharFilter(
        field_name="organization__uuid",
    )

    owner = CharFilter(
        field_name="owner__uuid",
    )

    created_by = CharFilter(
        field_name="created_by__uuid",
    )

    is_active = BooleanFilter(
        field_name="is_active",
    )

    is_expired = BooleanFilter(
        method="filter_is_expired",
    )

    used = BooleanFilter(
        method="filter_used",
    )

    scope = CharFilter(
        method="filter_scope",
    )

    def filter_is_expired(self, queryset, name, value):
        from django.db.models import Q
        from django.db.models.functions import Now

        if value:
            return queryset.filter(
                Q(expires_at__isnull=False) & Q(expires_at__lt=Now())
            )
        return queryset.filter(
            Q(expires_at__isnull=True) | Q(expires_at__gte=Now())
        )

    def filter_used(self, queryset, name, value):
        if value:
            return queryset.exclude(last_used_at__isnull=True)
        return queryset.filter(last_used_at__isnull=True)

    def filter_scope(self, queryset, name, value):
        return queryset.filter(scopes__contains=[value])

    class Meta:
        model = APIKey

        fields = (
            "organization",
            "owner",
            "created_by",
            "name",
            "prefix",
            "is_active",
            "is_expired",
            "used",
        )
