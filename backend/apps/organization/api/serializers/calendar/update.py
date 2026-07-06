from apps.organization.services.calendar import (
    CalendarService,
)

from .base import CalendarBaseSerializer


class CalendarUpdateSerializer(
    CalendarBaseSerializer,
):

    def update(
        self,
        instance,
        validated_data,
    ):
        return CalendarService.update(
            instance,
            **validated_data,
        )
