from apps.organization.services.work_hours import (
    WorkHoursService,
)

from .base import WorkHoursBaseSerializer


class WorkHoursCreateSerializer(
    WorkHoursBaseSerializer,
):

    def create(self, validated_data):
        return WorkHoursService.create(
            **validated_data,
        )
