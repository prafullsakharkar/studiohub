from django.db.models import Q
import django_filters
from apps.core.filters import BaseFilterSet
from apps.production.models import Project

class ProjectFilterSet(BaseFilterSet):
    search = django_filters.CharFilter(method="filter_search")
    status = django_filters.CharFilter(field_name="status", lookup_expr="iexact")
    type = django_filters.CharFilter(field_name="type", lookup_expr="iexact")
    code = django_filters.CharFilter(field_name="code", lookup_expr="iexact")
    name = django_filters.CharFilter(field_name="name", lookup_expr="icontains")

    class Meta:
        model = Project
        fields = ["status", "type", "code", "name"]

    def filter_search(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.filter(
            Q(name__icontains=value) |
            Q(code__icontains=value) |
            Q(description__icontains=value)
        )
