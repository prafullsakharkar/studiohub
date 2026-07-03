from apps.organization.services.holiday import HolidayService

from .base import HolidayBaseSerializer


class HolidayUpdateSerializer(
    HolidayBaseSerializer,
):

    def update(
        self,
        instance,
        validated_data,
    ):
        return HolidayService.update(
            instance,
            **validated_data,
        )
