import django_filters
from django.db.models import Q

from apps.core.filters import BaseFilterSet
from apps.production.models import Timelog


class TimelogFilterSet(BaseFilterSet):
    search = django_filters.CharFilter(method="filter_search")
    status = django_filters.CharFilter(field_name="status", lookup_expr="iexact")
    task = django_filters.UUIDFilter(field_name="task_id")
    project = django_filters.CharFilter(method="filter_project")
    # Frontend-contract alias: list hooks send `<name>_id` query params with
    # UUIDs, codes, or mock ids (`proj-001`). Strict UUIDFilters 400 on mock
    # ids, so the alias resolves tolerantly: unresolvable → no rows (mock
    # exact-match semantics), never a 400.
    project_id = django_filters.CharFilter(method="filter_project")
    person = django_filters.UUIDFilter(field_name="person_id")
    billable = django_filters.BooleanFilter(field_name="billable")
    date = django_filters.DateFilter(field_name="date")
    start_date = django_filters.DateFilter(field_name="date", lookup_expr="gte")
    end_date = django_filters.DateFilter(field_name="date", lookup_expr="lte")

    class Meta:
        model = Timelog
        fields = ["status", "task", "project", "project_id", "person", "billable", "date"]

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
            Q(notes__icontains=value) |
            Q(task_code__icontains=value) |
            Q(task_title__icontains=value) |
            Q(person_name_annotated__icontains=value) |
            Q(project_code_annotated__icontains=value) |
            Q(task_title_annotated__icontains=value)
        )
