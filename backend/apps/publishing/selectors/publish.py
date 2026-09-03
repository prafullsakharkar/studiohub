"""
Publishing selector for query operations.
"""
from __future__ import annotations

from django.db.models import QuerySet

from apps.core.selectors.base import BaseSelector
from apps.publishing.models import PublishItem


class PublishSelector(BaseSelector):
    """
    Read-side data access for publish items.

    Organization scoping is applied by the viewset through
    ``scope_by_request`` (fail closed).
    """

    model = PublishItem

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet:
        qs = cls.model.objects.select_related(
            "organization",
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
