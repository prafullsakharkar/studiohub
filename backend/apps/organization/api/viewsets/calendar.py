from apps.organization.api.filtersets.calendar import (
    CalendarFilterSet,
)
from apps.organization.api.serializers.calendar import (
    CalendarCreateSerializer,
    CalendarDetailSerializer,
    CalendarListSerializer,
    CalendarUpdateSerializer,
)
from apps.organization.api.viewsets.base import (
    OrganizationEntityViewSet,
)
from apps.organization.constants.permissions import (
    CalendarPermissions,
)
from apps.organization.models.calendar import (
    Calendar,
)
from apps.organization.selectors.calendar import (
    CalendarSelector,
)
from apps.organization.services.calendar import (
    CalendarService,
)


class CalendarViewSet(
    OrganizationEntityViewSet,
):
    """
    API endpoint for Calendar.
    """

    queryset = Calendar.objects.all()

    selector_class = CalendarSelector
    service_class = CalendarService

    filterset_class = CalendarFilterSet

    serializer_map = {
        "list": CalendarListSerializer,
        "retrieve": CalendarDetailSerializer,
        "create": CalendarCreateSerializer,
        "update": CalendarUpdateSerializer,
        "partial_update": CalendarUpdateSerializer,
    }

    permission_map = {
        "list": (CalendarPermissions.VIEW,),
        "retrieve": (CalendarPermissions.VIEW,),
        "create": (CalendarPermissions.CREATE,),
        "update": (CalendarPermissions.UPDATE,),
        "partial_update": (CalendarPermissions.UPDATE,),
        "destroy": (CalendarPermissions.DELETE,),
    }
