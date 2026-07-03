from apps.organization.api.filtersets.holiday import HolidayFilterSet
from apps.organization.api.serializers.holiday import (
    HolidayCreateSerializer,
    HolidayDetailSerializer,
    HolidayListSerializer,
    HolidayUpdateSerializer,
)
from apps.organization.api.viewsets.base import (
    OrganizationEntityViewSet,
)
from apps.organization.constants.permissions import (
    HolidayPermissions,
)
from apps.organization.models.holiday import Holiday
from apps.organization.selectors.holiday import HolidaySelector
from apps.organization.services.holiday import HolidayService


class HolidayViewSet(
    OrganizationEntityViewSet,
):
    """
    API endpoint for Holiday.
    """

    queryset = Holiday.objects.all()

    selector_class = HolidaySelector
    service_class = HolidayService

    filterset_class = HolidayFilterSet

    serializer_map = {
        "list": HolidayListSerializer,
        "retrieve": HolidayDetailSerializer,
        "create": HolidayCreateSerializer,
        "update": HolidayUpdateSerializer,
        "partial_update": HolidayUpdateSerializer,
    }

    permission_map = {
        "list": (HolidayPermissions.VIEW,),
        "retrieve": (HolidayPermissions.VIEW,),
        "create": (HolidayPermissions.CREATE,),
        "update": (HolidayPermissions.UPDATE,),
        "partial_update": (HolidayPermissions.UPDATE,),
        "destroy": (HolidayPermissions.DELETE,),
    }
