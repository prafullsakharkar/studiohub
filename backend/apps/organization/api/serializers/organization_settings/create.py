from apps.organization.services.organization_settings import (
    OrganizationSettingsService,
)

from .base import OrganizationSettingsBaseSerializer


class OrganizationSettingsCreateSerializer(
    OrganizationSettingsBaseSerializer,
):

    def create(
        self,
        validated_data,
    ):
        return OrganizationSettingsService.create(
            **validated_data,
        )
