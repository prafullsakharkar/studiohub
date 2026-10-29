import django_filters
from django.db.models import Q

from apps.core.filters import BaseFilterSet
from apps.production.models import Sequence


class SequenceFilterSet(BaseFilterSet):
    search = django_filters.CharFilter(method="filter_search")
    status = django_filters.CharFilter(field_name="status", lookup_expr="iexact")
    project = django_filters.CharFilter(method="filter_project")
    # Frontend-contract alias: list hooks send `<name>_id` query params with
    # UUIDs, codes, or mock ids (`proj-001`). Strict UUIDFilters 400 on mock
    # ids, so the alias resolves tolerantly: unresolvable → no rows (mock
    # exact-match semantics), never a 400.
    project_id = django_filters.CharFilter(method="filter_project")
    department = django_filters.CharFilter(field_name="department", lookup_expr="iexact")
    # An id, or a code of the episode in any project the caller can see.
    episode_id = django_filters.CharFilter(method="filter_episode")

    class Meta:
        model = Sequence
        fields = ["status", "project", "project_id", "department", "episode_id"]

    def filter_episode(self, queryset, name, value):
        if not value:
            return queryset
        from apps.production.selectors.episode import EpisodeSelector

        return queryset.filter(EpisodeSelector.lookup_q(value, prefix="episode__"))


    def filter_project(self, queryset, name, value):
        if not value:
            return queryset
        from apps.production.selectors.project import ProjectSelector

        project = ProjectSelector.resolve_by_lookup(value)
        if project is None:
            return queryset.none()
        return queryset.filter(project=project)

    def filter_search(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.filter(
            Q(name__icontains=value)
            | Q(code__icontains=value)
            | Q(description__icontains=value)
            | Q(department__icontains=value)
            | Q(lead_artist_name__icontains=value)
        )
