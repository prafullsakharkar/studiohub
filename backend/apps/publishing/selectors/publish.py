"""
Publishing selector for query operations.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from django.http import HttpRequest
    from rest_framework.viewsets import GenericViewSet


def get_publish_queryset(
    *,
    request: HttpRequest,
    view: GenericViewSet | None = None,
) -> QuerySet[PublishItem]:
    """Get filtered publish queryset for the current organization."""
    from apps.publishing.models import PublishItem

    qs = PublishItem.objects.select_related(
        "organization",
        "project",
    )

    # Filter by organization
    org = getattr(request, "organization", None)
    if org:
        qs = qs.filter(organization=org)

    # Apply view filters if available
    if view and hasattr(view, "filterset_class"):
        filterset = view.filterset_class(
            request.GET,
            queryset=qs,
            request=request,
        )
        if filterset.is_valid():
            qs = filterset.qs

    return qs


def get_publish_detail(
    *,
    publish_id: str,
    request: HttpRequest,
) -> "PublishItem | None":
    """Get a single publish by ID."""
    from apps.publishing.models import PublishItem

    org = getattr(request, "organization", None)

    qs = PublishItem.objects.select_related(
        "organization",
        "project",
    )

    if org:
        qs = qs.filter(organization=org)

    try:
        return qs.get(id=publish_id)
    except PublishItem.DoesNotExist:
        return None
