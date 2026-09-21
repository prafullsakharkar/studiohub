import django_filters
from django.db.models import Q

from apps.core.filters import BaseFilterSet
from apps.production.models import Show


class ShowFilterSet(BaseFilterSet):
    search = django_filters.CharFilter(method="filter_search")
    status = django_filters.CharFilter(field_name="status", lookup_expr="iexact")
    project = django_filters.CharFilter(method="filter_project")
    # Frontend-contract alias: callers send `project_id` (UUID/code).
    # Tolerant: unresolvable → no rows, never a 400.
    project_id = django_filters.CharFilter(method="filter_project")
    is_primary = django_filters.BooleanFilter(field_name="is_primary")

    class Meta:
        model = Show
        fields = ["status", "project", "project_id", "is_primary"]

    def filter_search(self, queryset, name, value):
        return queryset.filter(
            Q(name__icontains=value)
            | Q(code__icontains=value)
            | Q(description__icontains=value)
        )

    def filter_project(self, queryset, name, value):
        from apps.production.selectors.project import ProjectSelector

        project = ProjectSelector.resolve_by_lookup(
            getattr(self.request, "organization", None), value
        )
        if project is None:
            # Tolerate raw UUIDs the selector does not resolve.
            try:
                from uuid import UUID

                return queryset.filter(project_id=UUID(str(value)))
            except Exception:
                return queryset.none()
        return queryset.filter(project=project)
