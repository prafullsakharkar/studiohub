from apps.organization.services.holiday import HolidayService

from .base import HolidayBaseSerializer


class HolidayCreateSerializer(
    HolidayBaseSerializer,
):

    def create(self, validated_data):
        return HolidayService.create(
            **validated_data,
        )
