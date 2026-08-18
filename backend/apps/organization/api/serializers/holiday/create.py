from apps.organization.services.holiday import HolidayService

from .base import HolidaySerializer


class HolidayCreateSerializer(
    HolidaySerializer,
):

    def create(self, validated_data):
        return HolidayService.create(
            **validated_data,
        )
