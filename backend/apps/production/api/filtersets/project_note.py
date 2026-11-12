from uuid import UUID

import django_filters
from django.db.models import Exists, OuterRef
from django_filters.rest_framework import FilterSet

from apps.production.models import ProjectNote, ProjectNoteLink, ProjectNoteLinkType


def _uuid(value):
    try:
        return UUID(str(value).strip())
    except ValueError:
        return None


class ProjectNoteFilterSet(FilterSet):
    """
    The thread list's filters (C-RP-09). An unknown or malformed value gives no rows, never a 400.

    ``entity_type`` and ``entity_id`` match one and the same link: the threads with that record among
    their links (either one alone matches on that part only).
    """

    entity_type = django_filters.CharFilter(method="filter_record")
    entity_id = django_filters.CharFilter(method="filter_record")
    task_id = django_filters.CharFilter(method="filter_task")
    status = django_filters.CharFilter(field_name="status")
    author_id = django_filters.CharFilter(method="filter_author")

    class Meta:
        model = ProjectNote
        fields = ["entity_type", "entity_id", "task_id", "status", "author_id"]

    def filter_record(self, queryset, name, value):
        data = self.form.cleaned_data
        entity_type, entity_id = data.get("entity_type"), data.get("entity_id")
        links = ProjectNoteLink.objects.filter(note=OuterRef("pk"))
        if entity_type:
            if entity_type not in ProjectNoteLinkType.values:
                return queryset.none()
            links = links.filter(entity_type=entity_type)
        if entity_id:
            key = _uuid(entity_id)
            if key is None:
                return queryset.none()
            links = links.filter(entity_id=key)
        return queryset.filter(Exists(links))

    def filter_task(self, queryset, name, value):
        key = _uuid(value)
        return queryset.filter(task_id=key) if key else queryset.none()

    def filter_author(self, queryset, name, value):
        key = _uuid(value)
        return queryset.filter(author_id=key) if key else queryset.none()
