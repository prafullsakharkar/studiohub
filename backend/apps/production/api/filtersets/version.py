import django_filters
from django.db.models import Q

from apps.core.filters import BaseFilterSet
from apps.production.models import Version


class VersionFilterSet(BaseFilterSet):
    search = django_filters.CharFilter(method="filter_search")
    status = django_filters.CharFilter(field_name="status", lookup_expr="iexact")
    project = django_filters.CharFilter(method="filter_project")
    # Frontend-contract alias: list hooks send `<name>_id` query params with
    # UUIDs, codes, or mock ids (`proj-001`). Strict UUIDFilters 400 on mock
    # ids, so the alias resolves tolerantly: unresolvable → no rows (mock
    # exact-match semantics), never a 400.
    project_id = django_filters.CharFilter(method="filter_project")
    entity_type = django_filters.CharFilter(field_name="entity_type", lookup_expr="iexact")
    entity_id = django_filters.CharFilter(field_name="entity_id")
    is_published = django_filters.BooleanFilter(field_name="is_published")
    is_archived = django_filters.BooleanFilter(field_name="is_archived")
    department = django_filters.CharFilter(field_name="department", lookup_expr="iexact")

    class Meta:
        model = Version
        fields = ["status", "project", "project_id", "entity_type", "entity_id", "is_published", "is_archived", "department"]

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
            Q(version_number__icontains=value) |
            Q(entity_code__icontains=value) |
            Q(artist_name_annotated__icontains=value) |
            Q(project_code_annotated__icontains=value) |
            Q(entity_name_annotated__icontains=value)
        )
