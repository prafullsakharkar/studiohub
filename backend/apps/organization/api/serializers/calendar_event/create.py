from apps.organization.services.calendar_event import (
    CalendarEventService,
)

from .base import CalendarEventBaseSerializer


class CalendarEventCreateSerializer(
    CalendarEventBaseSerializer,
):

    def create(self, validated_data):
        return CalendarEventService.create(
            **validated_data,
        )
