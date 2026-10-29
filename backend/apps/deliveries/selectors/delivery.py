"""
Delivery selector for query operations.
"""

from __future__ import annotations

from django.db.models import QuerySet

from apps.core.selectors.base import BaseSelector
from apps.deliveries.models import DeliveryPackage
from apps.production.selectors.base import ProductionBaseSelector


class DeliverySelector(BaseSelector):
    """
    Read-side data access for delivery packages, narrowed to the caller's projects (SEC-DLV-01).

    Everything else is a 404 exactly like an unknown id. Platform admins see every delivery,
    including old ones that name no project; everyone else sees none of those. A read without a
    request sees nothing.
    """

    model = DeliveryPackage

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[DeliveryPackage]:
        qs = cls.model.objects.select_related(
            "project",
            "client",
            "destination",
        ).prefetch_related("versions__files")

        visible = ProductionBaseSelector.visible_project_ids(request) if request is not None else []
        if visible is not None:  # None: platform admin, nothing narrows
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
