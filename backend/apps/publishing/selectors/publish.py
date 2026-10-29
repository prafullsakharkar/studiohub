"""
Publishing selector for query operations.
"""
from __future__ import annotations

from django.db.models import QuerySet

from apps.core.selectors.base import BaseSelector
from apps.production.selectors.base import ProductionBaseSelector
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

        # The caller's projects only (404 on anything else). Platform admins see every job,
        # including old ones that name no project; everyone else sees none of those.
        visible = ProductionBaseSelector.visible_project_ids(request) if request is not None else []
        if visible is not None:
            qs = qs.filter(project_id__in=visible)

        if view is not None and hasattr(view, "filterset_class"):
            filterset = view.filterset_class(
                request.GET if request is not None else None,
                queryset=qs,
                request=request,
            )
            if filterset.is_valid():
                qs = filterset.qs

        return qs
