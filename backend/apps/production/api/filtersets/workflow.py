import django_filters
from django.db.models import Q

from apps.core.filters import BaseFilterSet
from apps.production.models import Workflow


class WorkflowFilterSet(BaseFilterSet):
    search = django_filters.CharFilter(method="filter_search")
    category = django_filters.CharFilter(field_name="category", lookup_expr="iexact")
    is_active = django_filters.BooleanFilter(field_name="is_active")
    department = django_filters.CharFilter(field_name="department", lookup_expr="iexact")
    project = django_filters.CharFilter(method="filter_project")
    # Frontend-contract alias: list hooks send `<name>_id` query params with
    # UUIDs, codes, or mock ids (`proj-001`). Strict UUIDFilters 400 on mock
    # ids, so the alias resolves tolerantly: unresolvable → no rows (mock
    # exact-match semantics), never a 400.
    project_id = django_filters.CharFilter(method="filter_project")
    event_type = django_filters.CharFilter(method="filter_event_type")

    class Meta:
        model = Workflow
        fields = ["category", "is_active", "department", "project", "project_id"]

    def _org(self):
        return getattr(getattr(self, "request", None), "organization", None)

    def filter_project(self, queryset, name, value):
        if not value:
            return queryset
        from apps.production.selectors.project import ProjectSelector

        project = ProjectSelector.resolve_by_lookup(self._org(), value)
        if project is None:
            return queryset.none()
        return queryset.filter(project=project)

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
