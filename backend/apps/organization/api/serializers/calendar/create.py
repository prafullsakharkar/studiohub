from apps.organization.services.calendar import (
    CalendarService,
)

from .base import CalendarBaseSerializer


class CalendarCreateSerializer(
    CalendarBaseSerializer,
):

    def create(
        self,
        validated_data,
    ):
        return CalendarService.create(
            **validated_data,
        )
