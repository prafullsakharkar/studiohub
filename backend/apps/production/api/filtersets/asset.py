import django_filters
from django.db.models import Q

from apps.core.filters import BaseFilterSet
from apps.production.models import Asset


class AssetFilterSet(BaseFilterSet):
    search = django_filters.CharFilter(method="filter_search")
    status = django_filters.CharFilter(field_name="status", lookup_expr="iexact")
    category = django_filters.CharFilter(field_name="category", lookup_expr="iexact")
    project = django_filters.UUIDFilter(field_name="project_id")
    department = django_filters.UUIDFilter(field_name="department_id")

    class Meta:
        model = Asset
        fields = ["status", "category", "project", "department"]

    def filter_search(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.filter(
            Q(name__icontains=value) |
            Q(code__icontains=value) |
            Q(description__icontains=value) |
            Q(category__icontains=value)
        )
