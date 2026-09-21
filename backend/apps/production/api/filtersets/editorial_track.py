import django_filters

from apps.core.filters import BaseFilterSet
from apps.production.models import EditorialTrack


class EditorialTrackFilterSet(BaseFilterSet):
    search = django_filters.CharFilter(method="filter_search")
    status = django_filters.CharFilter(field_name="status", lookup_expr="iexact")
    track_type = django_filters.CharFilter(field_name="track_type", lookup_expr="iexact")
    project = django_filters.CharFilter(method="filter_project")
    # Frontend-contract alias: hooks send `project_id` with UUIDs, codes,
    # or mock ids (`proj-001`). Tolerant: unresolvable → no rows, never 400.
    project_id = django_filters.CharFilter(method="filter_project")

    class Meta:
        model = EditorialTrack
        fields = ["status", "track_type", "project", "project_id"]

    def filter_search(self, queryset, name, value):
        from django.db.models import Q

        return queryset.filter(
            Q(name__icontains=value)
            | Q(track_type__icontains=value)
            | Q(status__icontains=value)
            | Q(cut_name__icontains=value)
        )

    def filter_project(self, queryset, name, value):
        from apps.production.selectors.base import ProductionBaseSelector

        # Reuse the tolerant project resolution used across production lists.
        selector = ProductionBaseSelector()
        resolve = getattr(selector, "resolve_project_lookup", None)
        if callable(resolve):
            project = resolve(value, request=getattr(self, "request", None))
            if project is None:
                return queryset.none()
            return queryset.filter(project=project)
        return queryset.filter(project_id=value)
