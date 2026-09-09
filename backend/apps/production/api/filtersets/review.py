import django_filters
from django.db.models import Q

from apps.core.filters import BaseFilterSet
from apps.production.models import Review


class ReviewFilterSet(BaseFilterSet):
    search = django_filters.CharFilter(method="filter_search")
    status = django_filters.CharFilter(field_name="status", lookup_expr="iexact")
    project = django_filters.UUIDFilter(field_name="project_id")
    entity_code = django_filters.CharFilter(field_name="entity_code", lookup_expr="iexact")
    entity_type = django_filters.CharFilter(field_name="entity_type", lookup_expr="iexact")

    class Meta:
        model = Review
        fields = ["status", "project", "entity_code", "entity_type"]

    def filter_search(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.filter(
            Q(title__icontains=value) |
            Q(code__icontains=value) |
            Q(entity_code__icontains=value)
        )
