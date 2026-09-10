import django_filters
from django.db.models import Q

from apps.core.filters import BaseFilterSet
from apps.production.models import Task


class TaskFilterSet(BaseFilterSet):
    search = django_filters.CharFilter(method="filter_search")
    status = django_filters.CharFilter(method="filter_status")
    priority = django_filters.CharFilter(method="filter_priority")
    project = django_filters.CharFilter(method="filter_project")
    # Frontend-contract aliases: list hooks send `<name>_id` query params with
    # UUIDs, codes, or mock ids (`proj-001`). Strict UUIDFilters 400 on mock
    # ids, so every FK alias resolves tolerantly: unresolvable → no rows
    # (mock exact-match semantics), never a 400.
    project_id = django_filters.CharFilter(method="filter_project")
    entity_type = django_filters.CharFilter(method="filter_entity_type")
    entity_id = django_filters.CharFilter(field_name="entity_id")
    department = django_filters.CharFilter(method="filter_department")
    team = django_filters.CharFilter(method="filter_team")
    team_id = django_filters.CharFilter(method="filter_team")
    assignee = django_filters.CharFilter(method="filter_assignee")
    assignee_id = django_filters.CharFilter(method="filter_assignee")
    vendor_id = django_filters.CharFilter(field_name="vendor_id", lookup_expr="iexact")
    # Accepted but not yet scoped: no Show model exists (see the Show epic).
    # Declared explicitly so the param documents intent and survives any
    # future strictness change instead of silently vanishing.
    show_id = django_filters.CharFilter(method="filter_show_id")
    is_archived = django_filters.CharFilter(method="filter_is_archived")

    class Meta:
        model = Task
        fields = ["status", "priority", "project", "project_id", "entity_type", "entity_id", "department", "team", "team_id", "assignee", "assignee_id", "vendor_id", "show_id", "is_archived"]

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

    def filter_team(self, queryset, name, value):
        if not value:
            return queryset
        try:
            return queryset.filter(team_id=value)
        except (ValueError, TypeError, Exception):
            return queryset.none()

    def filter_assignee(self, queryset, name, value):
        if not value:
            return queryset
        try:
            return queryset.filter(assignee_id=value)
        except (ValueError, TypeError, Exception):
            return queryset.none()

    def filter_show_id(self, queryset, name, value):
        return queryset

    def filter_search(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.filter(
            Q(title__icontains=value) |
            Q(code__icontains=value) |
            Q(description__icontains=value) |
            Q(entity_code__icontains=value) |
            Q(entity_name__icontains=value) |
            Q(assignee_name_annotated__icontains=value) |
            Q(project_code_annotated__icontains=value) |
            Q(department__icontains=value)
        )

    def filter_status(self, queryset, name, value):
        if not value or value == "ALL":
            return queryset
        return queryset.filter(status__iexact=value)

    def filter_priority(self, queryset, name, value):
        if not value or value == "ALL":
            return queryset
        return queryset.filter(priority__iexact=value)

    def filter_entity_type(self, queryset, name, value):
        if not value or value == "ALL":
            return queryset
        return queryset.filter(entity_type__iexact=value)

    def filter_department(self, queryset, name, value):
        if not value or value == "ALL":
            return queryset
        return queryset.filter(department__iexact=value)

    def filter_is_archived(self, queryset, name, value):
        if not value or value == "ALL":
            return queryset
        # Handle string boolean
        val = value.lower() in ("true", "1", "yes") if isinstance(value, str) else bool(value)
        return queryset.filter(is_archived=val)
