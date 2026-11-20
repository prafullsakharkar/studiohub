import uuid

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
    # Archived means soft-deleted (D-25); asking for it also brings the archived rows into the list.
    is_archived = django_filters.BooleanFilter(field_name="is_deleted")
    department = django_filters.CharFilter(field_name="department", lookup_expr="iexact")
    # RP-24 (C-RP-58): the versions waiting for the caller's review. Only "mine": the filter never takes
    # someone else's id, so it says nothing about who reviews what (Q-RP-110).
    to_review = django_filters.ChoiceFilter(choices=(("mine", "mine"),), method="filter_to_review")
    # RP-26 (C-RP-61, Q-RP-118): one task's versions, read as tasks/?reviewer_id= is (never a 400).
    task_id = django_filters.CharFilter(method="filter_task")

    class Meta:
        model = Version
        fields = ["status", "project", "project_id", "entity_type", "entity_id", "is_published", "is_archived", "department", "to_review", "task_id"]


    def filter_project(self, queryset, name, value):
        if not value:
            return queryset
        from apps.production.selectors.project import ProjectSelector

        project = ProjectSelector.resolve_by_lookup(value)
        if project is None:
            return queryset.none()
        return queryset.filter(project=project)

    def filter_to_review(self, queryset, name, value):
        """In Pending Review, on a live task whose reviewer is the caller (Q-RP-109)."""
        if not value:
            return queryset
        from apps.production.constants import ProductionStatus, TaskStatus

        user = getattr(self.request, "user", None)
        if user is None or not user.is_authenticated:
            return queryset.none()
        return queryset.filter(
            status=ProductionStatus.PENDING_REVIEW,
            task__reviewer=user,
            task__is_deleted=False,
        ).exclude(task__status=TaskStatus.ARCHIVED)

    def filter_task(self, queryset, name, value):
        """The versions of one task; an unknown or malformed id gives no rows (Q-RP-118)."""
        if not value:
            return queryset
        try:
            return queryset.filter(task_id=uuid.UUID(str(value)))
        except (ValueError, TypeError):
            return queryset.none()

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
