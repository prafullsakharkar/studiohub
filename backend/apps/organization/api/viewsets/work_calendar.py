from apps.organization.api.filtersets.work_calendar import (
    WorkCalendarFilterSet,
)
from apps.organization.api.serializers.work_calendar import (
    WorkCalendarCreateSerializer,
    WorkCalendarDetailSerializer,
    WorkCalendarListSerializer,
    WorkCalendarUpdateSerializer,
)
from apps.organization.api.viewsets.base import (
    OrganizationEntityViewSet,
)
from apps.organization.constants.permissions import (
    WorkCalendarPermissions,
)
from apps.organization.models.work_calendar import (
    WorkCalendar,
)
from apps.organization.selectors.work_calendar import (
    WorkCalendarSelector,
)
from apps.organization.services.work_calendar import (
    WorkCalendarService,
)


class WorkCalendarViewSet(
    OrganizationEntityViewSet,
):
    """
    API endpoint for WorkCalendar.
    """

    queryset = WorkCalendar.objects.all()

    selector_class = WorkCalendarSelector
    service_class = WorkCalendarService

    filterset_class = WorkCalendarFilterSet

    serializer_map = {
        "list": WorkCalendarListSerializer,
        "retrieve": WorkCalendarDetailSerializer,
        "create": WorkCalendarCreateSerializer,
        "update": WorkCalendarUpdateSerializer,
        "partial_update": WorkCalendarUpdateSerializer,
    }

    permission_map = {
        "list": (WorkCalendarPermissions.VIEW,),
        "retrieve": (WorkCalendarPermissions.VIEW,),
        "create": (WorkCalendarPermissions.CREATE,),
        "update": (WorkCalendarPermissions.UPDATE,),
        "partial_update": (WorkCalendarPermissions.UPDATE,),
        "destroy": (WorkCalendarPermissions.DELETE,),
    }
