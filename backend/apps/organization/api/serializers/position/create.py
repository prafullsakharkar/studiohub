from apps.organization.services.position import (
    PositionService,
)

from .base import PositionBaseSerializer


class PositionCreateSerializer(
    PositionBaseSerializer,
):

    def create(self, validated_data):
        return PositionService.create(
            **validated_data,
        )
