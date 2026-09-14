import django_filters
from django.db.models import Q

from apps.core.filters import BaseFilterSet
from apps.production.models import Shot


class ShotFilterSet(BaseFilterSet):
    search = django_filters.CharFilter(method="filter_search")
    status = django_filters.CharFilter(field_name="status", lookup_expr="iexact")
    project = django_filters.CharFilter(method="filter_project")
    # Frontend-contract alias: list hooks send `<name>_id` query params with
    # UUIDs, codes, or mock ids (`proj-001`). Strict UUIDFilters 400 on mock
    # ids, so the alias resolves tolerantly: unresolvable → no rows (mock
    # exact-match semantics), never a 400.
    project_id = django_filters.CharFilter(method="filter_project")
    sequence_code = django_filters.CharFilter(field_name="sequence_code", lookup_expr="iexact")
    # Frontend-contract alias (defensive; no current caller sends bare `sequence`).
    sequence = django_filters.CharFilter(field_name="sequence_code", lookup_expr="iexact")
    code = django_filters.CharFilter(field_name="code", lookup_expr="iexact")

    class Meta:
        model = Shot
        fields = ["status", "project", "project_id", "sequence_code", "sequence", "code"]

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
            Q(code__icontains=value) |
            Q(name__icontains=value) |
            Q(description__icontains=value) |
            Q(sequence_code__icontains=value)
        )
