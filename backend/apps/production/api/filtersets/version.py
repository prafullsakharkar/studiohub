from django.db.models import Q
import django_filters
from apps.core.filters import BaseFilterSet
from apps.production.models import Version

class VersionFilterSet(BaseFilterSet):
    search = django_filters.CharFilter(method="filter_search")
    status = django_filters.CharFilter(field_name="status", lookup_expr="iexact")
    project = django_filters.UUIDFilter(field_name="project_id")
    entity_type = django_filters.CharFilter(field_name="entity_type", lookup_expr="iexact")
    entity_id = django_filters.CharFilter(field_name="entity_id")
    is_published = django_filters.BooleanFilter(field_name="is_published")
    is_archived = django_filters.BooleanFilter(field_name="is_archived")
    department = django_filters.CharFilter(field_name="department", lookup_expr="iexact")

    class Meta:
        model = Version
        fields = ["status", "project", "entity_type", "entity_id", "is_published", "is_archived", "department"]

    def filter_search(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.filter(
            Q(code__icontains=value) |
            Q(version_number__icontains=value) |
            Q(entity_code__icontains=value)
        )
