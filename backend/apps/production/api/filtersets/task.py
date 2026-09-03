import django_filters
from django.db.models import Q

from apps.core.filters import BaseFilterSet
from apps.production.models import Task


class TaskFilterSet(BaseFilterSet):
    search = django_filters.CharFilter(method="filter_search")
    status = django_filters.CharFilter(method="filter_status")
    priority = django_filters.CharFilter(method="filter_priority")
    project = django_filters.UUIDFilter(field_name="project_id")
    entity_type = django_filters.CharFilter(method="filter_entity_type")
    entity_id = django_filters.CharFilter(field_name="entity_id")
    department = django_filters.CharFilter(method="filter_department")
    team = django_filters.UUIDFilter(field_name="team_id")
    assignee = django_filters.UUIDFilter(field_name="assignee_id")
    is_archived = django_filters.CharFilter(method="filter_is_archived")

    class Meta:
        model = Task
        fields = ["status", "priority", "project", "entity_type", "entity_id", "department", "team", "assignee", "is_archived"]

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
