from apps.organization.services.work_hours import (
    WorkHoursService,
)

from .base import WorkHoursBaseSerializer


class WorkHoursUpdateSerializer(
    WorkHoursBaseSerializer,
):

    def update(
        self,
        instance,
        validated_data,
    ):
        return WorkHoursService.update(
            instance,
            **validated_data,
        )
