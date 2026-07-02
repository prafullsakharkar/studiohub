from apps.organization.services.office import (
    OfficeService,
)

from .base import OfficeBaseSerializer


class OfficeUpdateSerializer(
    OfficeBaseSerializer,
):

    def update(
        self,
        instance,
        validated_data,
    ):
        return OfficeService.update(
            instance,
            **validated_data,
        )
