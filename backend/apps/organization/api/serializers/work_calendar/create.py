from apps.organization.services.work_calendar import (
    WorkCalendarService,
)

from .base import (
    WorkCalendarBaseSerializer,
)


class WorkCalendarCreateSerializer(
    WorkCalendarBaseSerializer,
):

    def create(
        self,
        validated_data,
    ):
        return WorkCalendarService.create(
            **validated_data,
        )
