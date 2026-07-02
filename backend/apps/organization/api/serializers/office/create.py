from apps.organization.services.office import (
    OfficeService,
)

from .base import OfficeBaseSerializer


class OfficeCreateSerializer(
    OfficeBaseSerializer,
):

    def create(self, validated_data):
        return OfficeService.create(
            **validated_data,
        )
