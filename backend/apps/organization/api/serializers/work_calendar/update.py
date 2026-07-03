from apps.organization.services.work_calendar import (
    WorkCalendarService,
)

from .base import (
    WorkCalendarBaseSerializer,
)


class WorkCalendarUpdateSerializer(
    WorkCalendarBaseSerializer,
):

    def update(
        self,
        instance,
        validated_data,
    ):
        return WorkCalendarService.update(
            instance,
            **validated_data,
        )
