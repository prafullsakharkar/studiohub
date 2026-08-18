"""
Tag selectors.
"""

from __future__ import annotations

from django.db.models import QuerySet

from apps.core.models.tag import Tag
from apps.core.selectors.base import BaseSelector


class TagSelector(BaseSelector):
    """
    Selector for Tag model.

    This selector provides domain-neutral access to tags.
    Applications should override get_queryset to implement
    domain-specific filtering logic.
    """

    model = Tag

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ) -> QuerySet:
        """
        Get queryset for Tag.

        By default, returns all tags. Applications should
        override this method to implement domain-specific filtering.
        """
        return cls.model.objects.all()
