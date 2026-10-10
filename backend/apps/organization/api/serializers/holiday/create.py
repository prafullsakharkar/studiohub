from rest_framework import serializers

from apps.organization.models import WorkCalendar
from apps.organization.services.holiday import HolidayService

from .base import HolidaySerializer


class HolidayCreateSerializer(
    HolidaySerializer,
):
    # Optional at the contract level: HolidayService.before_create defaults
    # it to the org's default work calendar (the workspace UI sends none).
    work_calendar = serializers.PrimaryKeyRelatedField(
        queryset=WorkCalendar.objects.all(), required=False, allow_null=True
    )

    def create(self, validated_data):
        return HolidayService.create(
            **validated_data,
        )
