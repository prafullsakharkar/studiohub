"""
Publishing selector for query operations.
"""
from __future__ import annotations

from django.db.models import QuerySet

from apps.core.selectors.base import BaseSelector
from apps.publishing.models import PublishItem


class PublishSelector(BaseSelector):
    """
    Read-side data access for publish items (platform-global).
    """

    model = PublishItem

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[PublishItem]:
        qs = cls.model.objects.select_related(
            "project",
        )

        if view is not None and hasattr(view, "filterset_class"):
            filterset = view.filterset_class(
                request.GET if request is not None else None,
                queryset=qs,
                request=request,
            )
            if filterset.is_valid():
                qs = filterset.qs

        return qs
