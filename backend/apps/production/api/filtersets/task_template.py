import django_filters

from apps.core.filters import BaseFilterSet
from apps.production.models import TaskTemplate


class TaskTemplateFilterSet(BaseFilterSet):
    entity_type = django_filters.CharFilter(field_name="entity_type", lookup_expr="iexact")
    is_active = django_filters.BooleanFilter(field_name="is_active")
    # An id or a code; "studio" is not a project, use ?studio=true for the studio-wide ones.
    project_id = django_filters.CharFilter(method="filter_project")
    studio = django_filters.BooleanFilter(method="filter_studio")

    class Meta:
        model = TaskTemplate
        fields = ["entity_type", "is_active", "project_id", "studio"]

    def filter_project(self, queryset, name, value):
        if not value:
            return queryset
        from apps.production.selectors.project import ProjectSelector

        project = ProjectSelector.resolve_by_lookup(value)
        return queryset.none() if project is None else queryset.filter(project=project)

    def filter_studio(self, queryset, name, value):
        return queryset.filter(project__isnull=bool(value))
