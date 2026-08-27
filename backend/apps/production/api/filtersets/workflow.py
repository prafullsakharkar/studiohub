from django.db.models import Q
import django_filters
from apps.core.filters import BaseFilterSet
from apps.production.models import Workflow

class WorkflowFilterSet(BaseFilterSet):
    search = django_filters.CharFilter(method="filter_search")
    category = django_filters.CharFilter(field_name="category", lookup_expr="iexact")
    is_active = django_filters.BooleanFilter(field_name="is_active")
    department = django_filters.CharFilter(field_name="department", lookup_expr="iexact")
    project = django_filters.UUIDFilter(field_name="project_id")
    event_type = django_filters.CharFilter(method="filter_event_type")

    class Meta:
        model = Workflow
        fields = ["category", "is_active", "department", "project"]

    def filter_search(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.filter(
            Q(name__icontains=value) |
            Q(code__icontains=value) |
            Q(description__icontains=value)
        )

    def filter_event_type(self, queryset, name, value):
        if not value:
            return queryset
        # Handle CSV multi-value
        values = [v.strip() for v in value.split(",")]
        q = Q()
        for v in values:
            q |= Q(category__iexact=v)
        return queryset.filter(q)
