from apps.organization.services.position import (
    PositionService,
)

from .base import PositionBaseSerializer


class PositionUpdateSerializer(
    PositionBaseSerializer,
):

    def update(
        self,
        instance,
        validated_data,
    ):
        return PositionService.update(
            instance,
            **validated_data,
        )
