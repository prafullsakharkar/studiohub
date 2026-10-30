"""
Filters of the delivery list (CR-17): ``/deliveries/`` and the project's ``/projects/{id}/deliveries/``.

``status`` takes the words the read shape shows (``Ready``, ``Completed``) as well as the stored ones
(``Prepared``, ``Complete``), in any case. Related records are filtered by id under both spellings the
frontend uses (``client`` / ``client_id``, ``project`` / ``project_id``, ``destination`` / ``destination_id``).
A value that is not an id is a 400 (django-filter), a status nobody has answers an empty list.
"""

from __future__ import annotations

import django_filters

from apps.core.filters import BaseFilterSet
from apps.deliveries.constants.workflow import STATUSES
from apps.deliveries.models import DeliveryPackage

#: What the read shape says -> what is stored (the inverse of ``STATUS_OUTPUT_MAP``).
_READ_WORDS = {
    "ready": DeliveryPackage.STATUS_PREPARED,
    "completed": DeliveryPackage.STATUS_COMPLETE,
}
_STORED = {status.lower(): status for status in STATUSES}


class DeliveryFilterSet(BaseFilterSet):
    status = django_filters.CharFilter(method="filter_status")
    client_status = django_filters.CharFilter(field_name="client_status", lookup_expr="iexact")
    delivery_method = django_filters.CharFilter(field_name="delivery_method", lookup_expr="iexact")
    client = django_filters.UUIDFilter(field_name="client_id")
    client_id = django_filters.UUIDFilter(field_name="client_id")
    project = django_filters.UUIDFilter(field_name="project_id")
    project_id = django_filters.UUIDFilter(field_name="project_id")
    destination = django_filters.UUIDFilter(field_name="destination_id")
    destination_id = django_filters.UUIDFilter(field_name="destination_id")

    class Meta:
        model = DeliveryPackage
        fields: list[str] = []

    def filter_status(self, queryset, name, value):
        word = (value or "").strip().lower()
        if not word:
            return queryset
        stored = _READ_WORDS.get(word) or _STORED.get(word)
        return queryset.filter(status=stored) if stored else queryset.none()
