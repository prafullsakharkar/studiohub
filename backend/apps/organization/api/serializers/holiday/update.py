from apps.organization.services.holiday import HolidayService

from .base import HolidaySerializer


class HolidayUpdateSerializer(
    HolidaySerializer,
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
