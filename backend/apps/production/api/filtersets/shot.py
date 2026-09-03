import django_filters
from django.db.models import Q

from apps.core.filters import BaseFilterSet
from apps.production.models import Shot


class ShotFilterSet(BaseFilterSet):
    search = django_filters.CharFilter(method="filter_search")
    status = django_filters.CharFilter(field_name="status", lookup_expr="iexact")
    project = django_filters.UUIDFilter(field_name="project_id")
    sequence_code = django_filters.CharFilter(field_name="sequence_code", lookup_expr="iexact")
    code = django_filters.CharFilter(field_name="code", lookup_expr="iexact")

    class Meta:
        model = Shot
        fields = ["status", "project", "sequence_code", "code"]

    def filter_search(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.filter(
            Q(code__icontains=value) |
            Q(name__icontains=value) |
            Q(description__icontains=value) |
            Q(sequence_code__icontains=value)
        )
