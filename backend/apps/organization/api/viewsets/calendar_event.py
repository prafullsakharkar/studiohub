"""
CalendarEvent API viewset.
"""

from apps.core.api.pagination import StandardPagination
from apps.organization.api.filtersets.calendar_event import CalendarEventFilterSet
from apps.organization.api.serializers.calendar_event import (
    CalendarEventCreateSerializer,
    CalendarEventDetailSerializer,
    CalendarEventListSerializer,
    CalendarEventUpdateSerializer,
)
from apps.organization.api.viewsets.base import (
    OrganizationEntityViewSet,
)
from apps.organization.api.viewsets.compat import IdOrCodeDetailMixin
from apps.organization.api.viewsets.context import OrganizationContextMixin
from apps.organization.constants.permissions import CalendarEventPermissions
from apps.organization.models.calendar_event import CalendarEvent
from apps.organization.selectors.calendar_event import CalendarEventSelector
from apps.organization.services.calendar_event import CalendarEventService


class CalendarEventViewSet(
    OrganizationContextMixin,
    IdOrCodeDetailMixin,
    OrganizationEntityViewSet,  # pyright: ignore[reportMissingTypeArgument]
):
    """
    API endpoint for CalendarEvent.
    """

    queryset = CalendarEvent.objects.all()

    selector_class = CalendarEventSelector
    service_class = CalendarEventService

    filterset_class = CalendarEventFilterSet

    serializer_map = {
        "list": CalendarEventListSerializer,
        "retrieve": CalendarEventDetailSerializer,
        "create": CalendarEventCreateSerializer,
        "update": CalendarEventUpdateSerializer,
        "partial_update": CalendarEventUpdateSerializer,
    }

    pagination_class = StandardPagination

    permission_map = {
        "list": (CalendarEventPermissions.VIEW,),
        "retrieve": (CalendarEventPermissions.VIEW,),
        "create": (CalendarEventPermissions.CREATE,),
        "update": (CalendarEventPermissions.UPDATE,),
        "partial_update": (CalendarEventPermissions.UPDATE,),
        "destroy": (CalendarEventPermissions.DELETE,),
    }
