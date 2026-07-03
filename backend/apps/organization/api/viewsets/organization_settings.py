from apps.organization.api.filtersets.organization_settings import (
    OrganizationSettingsFilterSet,
)
from apps.organization.api.serializers.organization_settings import (
    OrganizationSettingsCreateSerializer,
    OrganizationSettingsDetailSerializer,
    OrganizationSettingsListSerializer,
    OrganizationSettingsUpdateSerializer,
)
from apps.organization.api.viewsets.base import (
    OrganizationEntityViewSet,
)
from apps.organization.constants.permissions import (
    OrganizationSettingsPermissions,
)
from apps.organization.models.organization_settings import (
    OrganizationSettings,
)
from apps.organization.selectors.organization_settings import (
    OrganizationSettingsSelector,
)
from apps.organization.services.organization_settings import (
    OrganizationSettingsService,
)


class OrganizationSettingsViewSet(
    OrganizationEntityViewSet,
):
    """
    API endpoint for Organization Settings.
    """

    queryset = OrganizationSettings.objects.all()

    selector_class = OrganizationSettingsSelector
    service_class = OrganizationSettingsService

    filterset_class = OrganizationSettingsFilterSet

    serializer_map = {
        "list": OrganizationSettingsListSerializer,
        "retrieve": OrganizationSettingsDetailSerializer,
        "create": OrganizationSettingsCreateSerializer,
        "update": OrganizationSettingsUpdateSerializer,
        "partial_update": OrganizationSettingsUpdateSerializer,
    }

    permission_map = {
        "list": (OrganizationSettingsPermissions.VIEW,),
        "retrieve": (OrganizationSettingsPermissions.VIEW,),
        "create": (OrganizationSettingsPermissions.CREATE,),
        "update": (OrganizationSettingsPermissions.UPDATE,),
        "partial_update": (OrganizationSettingsPermissions.UPDATE,),
        "destroy": (OrganizationSettingsPermissions.DELETE,),
    }
