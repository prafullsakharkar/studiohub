"""
Delivery selector for query operations.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from django.http import HttpRequest
    from rest_framework.viewsets import GenericViewSet


def get_delivery_queryset(
    *,
    request: HttpRequest,
    view: "GenericViewSet | None" = None,
) -> "QuerySet[DeliveryPackage]":
    """Get filtered delivery queryset for the current organization."""
    from apps.deliveries.models import DeliveryPackage
    
    qs = DeliveryPackage.objects.select_related(
        "organization",
        "project",
        "client",
    ).prefetch_related("versions")
    
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


def get_delivery_detail(
    *,
    delivery_id: str,
    request: HttpRequest,
) -> "DeliveryPackage | None":
    """Get a single delivery by ID."""
    from apps.deliveries.models import DeliveryPackage
    
    org = getattr(request, "organization", None)
    
    qs = DeliveryPackage.objects.select_related(
        "organization",
        "project",
        "client",
    ).prefetch_related("versions")
    
    if org:
        qs = qs.filter(organization=org)
    
    try:
        return qs.get(id=delivery_id)
    except DeliveryPackage.DoesNotExist:
        return None


def get_delivery_versions(
    *,
    delivery_id: str,
    request: HttpRequest,
) -> "QuerySet[DeliveryVersionRef]":
    """Get versions for a delivery."""
    from apps.deliveries.models import DeliveryVersionRef
    
    org = getattr(request, "organization", None)
    
    qs = DeliveryVersionRef.objects.select_related(
        "version",
        "delivery",
    )
    
    if org:
        qs = qs.filter(delivery__organization=org)
    
    return qs.filter(delivery_id=delivery_id)
