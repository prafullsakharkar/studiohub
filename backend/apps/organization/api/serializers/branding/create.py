from apps.organization.services.branding import (
    BrandingService,
)

from .base import BrandingBaseSerializer


class BrandingCreateSerializer(
    BrandingBaseSerializer,
):

    def create(
        self,
        validated_data,
    ):
        return BrandingService.create(
            **validated_data,
        )
