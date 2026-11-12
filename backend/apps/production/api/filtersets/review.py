from uuid import UUID

import django_filters
from django.db.models import Exists, OuterRef, Q

from apps.core.filters import BaseFilterSet
from apps.production.models import Review, ReviewItem


class ReviewFilterSet(BaseFilterSet):
    search = django_filters.CharFilter(method="filter_search")
    status = django_filters.CharFilter(field_name="status", lookup_expr="iexact")
    project = django_filters.CharFilter(method="filter_project")
    # Frontend-contract alias: list hooks send `<name>_id` query params with
    # UUIDs, codes, or mock ids (`proj-001`). Strict UUIDFilters 400 on mock
    # ids, so the alias resolves tolerantly: unresolvable → no rows (mock
    # exact-match semantics), never a 400.
    project_id = django_filters.CharFilter(method="filter_project")
    entity_code = django_filters.CharFilter(field_name="entity_code", lookup_expr="iexact")
    entity_type = django_filters.CharFilter(field_name="entity_type", lookup_expr="iexact")
    #: the reviews showing this version (a live ``ReviewItem``); unknown or malformed: no rows, never a 400 (C-RP-03)
    version_id = django_filters.CharFilter(method="filter_version")

    class Meta:
        model = Review
        fields = ["status", "project", "project_id", "entity_code", "entity_type", "version_id"]

    def filter_version(self, queryset, name, value):
        if not value:
            return queryset
        try:
            key = UUID(str(value))
        except ValueError:
            return queryset.none()
        items = ReviewItem.objects.filter(review=OuterRef("pk"), version_id=key, is_deleted=False)
        return queryset.filter(Exists(items))


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
            Q(title__icontains=value) |
            Q(code__icontains=value) |
            Q(entity_code__icontains=value)
        )
