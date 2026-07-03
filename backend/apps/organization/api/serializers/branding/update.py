from apps.organization.services.branding import (
    BrandingService,
)

from .base import BrandingBaseSerializer


class BrandingUpdateSerializer(
    BrandingBaseSerializer,
):

    def update(
        self,
        instance,
        validated_data,
    ):
        return BrandingService.update(
            instance,
            **validated_data,
        )
