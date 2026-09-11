"""
WorkHours API viewset.
"""

from apps.core.api.pagination import StandardPagination
from apps.organization.api.filtersets.work_hours import (
    WorkHoursFilterSet,
)
from apps.organization.api.serializers.work_hours import (
    WorkHoursCreateSerializer,
    WorkHoursDetailSerializer,
    WorkHoursListSerializer,
    WorkHoursUpdateSerializer,
)
from apps.organization.api.viewsets.base import (
    OrganizationEntityViewSet,
)
from apps.organization.api.viewsets.compat import IdOrCodeDetailMixin
from apps.organization.api.viewsets.context import OrganizationContextMixin
from apps.organization.constants.permissions import (
    WorkHoursPermissions,
)
from apps.organization.models.work_hours import (
    WorkHours,
)
from apps.organization.selectors.work_hours import (
    WorkHoursSelector,
)
from apps.organization.services.work_hours import (
    WorkHoursService,
)


class WorkHoursViewSet(
    OrganizationContextMixin,
    IdOrCodeDetailMixin,
    OrganizationEntityViewSet,  # pyright: ignore[reportMissingTypeArgument]
):
    """
    API endpoint for WorkHours.
    """

    queryset = WorkHours.objects.all()

    selector_class = WorkHoursSelector
    service_class = WorkHoursService

    filterset_class = WorkHoursFilterSet

    serializer_map = {
        "list": WorkHoursListSerializer,
        "retrieve": WorkHoursDetailSerializer,
        "create": WorkHoursCreateSerializer,
        "update": WorkHoursUpdateSerializer,
        "partial_update": WorkHoursUpdateSerializer,
    }

    pagination_class = StandardPagination

    permission_map = {
        "list": (WorkHoursPermissions.VIEW,),
        "retrieve": (WorkHoursPermissions.VIEW,),
        "create": (WorkHoursPermissions.CREATE,),
        "update": (WorkHoursPermissions.UPDATE,),
        "partial_update": (WorkHoursPermissions.UPDATE,),
        "destroy": (WorkHoursPermissions.DELETE,),
    }