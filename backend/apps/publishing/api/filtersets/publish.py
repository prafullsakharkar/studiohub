"""
Filters of the export-job list (CR-22).

``status`` takes the real job statuses (``Exported``) and the legacy words the read shape still shows in its
``status`` field (``Queued``, ``Publishing``, ``Published``, ``Failed``, ``Unpublished``), in any case. The legacy
``Published`` is both Validated and Exported, so it matches both; ``job_status`` takes the real ones only. Related
records are filtered by id under both spellings the frontend uses (``version`` / ``version_id``, ``project`` /
``project_id``). A value that is not an id is a 400, a status nobody has answers an empty list.
"""

from __future__ import annotations

import django_filters
from django.db.models import Q

from apps.core.filters import BaseFilterSet
from apps.publishing.models import PublishItem

_REAL = {status.lower(): status for status, _label in PublishItem.STATUS_CHOICES}
#: What the read shape's ``status`` says -> the stored statuses it stands for.
_LEGACY = {
    "queued": [PublishItem.STATUS_PENDING],
    "publishing": [PublishItem.STATUS_EXPORTING],
    "published": [PublishItem.STATUS_VALIDATED, PublishItem.STATUS_EXPORTED],
    "unpublished": [PublishItem.STATUS_CANCELLED],
}


class PublishFilterSet(BaseFilterSet):
    status = django_filters.CharFilter(method="filter_status")
    job_status = django_filters.CharFilter(method="filter_job_status")
    dcc_tool = django_filters.CharFilter(field_name="dcc_tool", lookup_expr="iexact")
    entity_type = django_filters.CharFilter(field_name="entity_type", lookup_expr="iexact")
    version = django_filters.UUIDFilter(field_name="version_id")
    version_id = django_filters.UUIDFilter(field_name="version_id")
    project = django_filters.UUIDFilter(field_name="project_id")
    project_id = django_filters.UUIDFilter(field_name="project_id")

    class Meta:
        model = PublishItem
        fields: list[str] = []

    def filter_status(self, queryset, name, value):
        word = (value or "").strip().lower()
        if not word:
            return queryset
        if word in _REAL:
            return queryset.filter(status=_REAL[word])
        if word in _LEGACY:
            match = Q(status__in=_LEGACY[word])
            # An unpublished job reads "Unpublished" whatever its stored status (the read shape's rule).
            return (
                queryset.filter(match | Q(is_archived=True))
                if word == "unpublished"
                else queryset.filter(match, is_archived=False)
            )
        return queryset.none()

    def filter_job_status(self, queryset, name, value):
        word = (value or "").strip().lower()
        if not word:
            return queryset
        return queryset.filter(status=_REAL[word]) if word in _REAL else queryset.none()
