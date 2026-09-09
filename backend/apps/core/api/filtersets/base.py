"""
Core API filtersets.

Provides filterset classes for core models.
"""

from __future__ import annotations

import django_filters
from django_filters import FilterSet

from apps.core.models.attachment import Attachment
from apps.core.models.tag import Tag


class BaseFilter(django_filters.Filter):
    """Base filter class for core filters."""


class BaseFilterSet(FilterSet):
    """Base filterset class for core filtersets."""


class AttachmentFilterSet(BaseFilterSet):
    """Filterset for Attachment model."""

    class Meta:
        model = Attachment
        fields = {
            "name": ["exact", "icontains"],
            "file_type": ["exact"],
            "mime_type": ["exact"],
            "is_public": ["exact"],
            "created_at": ["exact", "gte", "lte"],
        }


class TagFilterSet(BaseFilterSet):
    """Filterset for Tag model."""

    class Meta:
        model = Tag
        fields = {
            "name": ["exact", "icontains"],
            "color": ["exact"],
            "is_system": ["exact"],
        }
