from apps.organization.services import (
    OrganizationSettingsService,
)

from .base import OrganizationSettingsBaseSerializer


class OrganizationSettingsUpdateSerializer(
    OrganizationSettingsBaseSerializer,
):

    def update(
        self,
        instance,
        validated_data,
    ):
        return OrganizationSettingsService.update(
            instance,
            **validated_data,
        )
