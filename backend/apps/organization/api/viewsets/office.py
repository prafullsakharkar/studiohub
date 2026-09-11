"""
Office API viewset.
"""

from apps.core.api.pagination import StandardPagination
from apps.organization.api.filtersets.office import OfficeFilterSet
from apps.organization.api.serializers.office import (
    OfficeCreateSerializer,
    OfficeDetailSerializer,
    OfficeListSerializer,
    OfficeUpdateSerializer,
)
from apps.organization.api.viewsets.base import (
    OrganizationEntityViewSet,
)
from apps.organization.api.viewsets.compat import IdOrCodeDetailMixin
from apps.organization.api.viewsets.context import OrganizationContextMixin
from apps.organization.constants.permissions import OfficePermissions
from apps.organization.models.office import Office
from apps.organization.selectors.office import OfficeSelector
from apps.organization.services.office import OfficeService


class OfficeViewSet(
    OrganizationContextMixin,
    IdOrCodeDetailMixin,
    OrganizationEntityViewSet,  # pyright: ignore[reportMissingTypeArgument]
):
    """
    API endpoint for Office.
    """

    queryset = Office.objects.all()

    selector_class = OfficeSelector
    service_class = OfficeService

    filterset_class = OfficeFilterSet

    serializer_map = {
        "list": OfficeListSerializer,
        "retrieve": OfficeDetailSerializer,
        "create": OfficeCreateSerializer,
        "update": OfficeUpdateSerializer,
        "partial_update": OfficeUpdateSerializer,
    }

    pagination_class = StandardPagination

    permission_map = {
        "list": (OfficePermissions.VIEW,),
        "retrieve": (OfficePermissions.VIEW,),
        "create": (OfficePermissions.CREATE,),
        "update": (OfficePermissions.UPDATE,),
        "partial_update": (OfficePermissions.UPDATE,),
        "destroy": (OfficePermissions.DELETE,),
    }