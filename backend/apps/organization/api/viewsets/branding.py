from apps.organization.api.filtersets.branding import (
    BrandingFilterSet,
)
from apps.organization.api.serializers.branding import (
    BrandingCreateSerializer,
    BrandingDetailSerializer,
    BrandingListSerializer,
    BrandingUpdateSerializer,
)
from apps.organization.api.viewsets.base import (
    OrganizationEntityViewSet,
)
from apps.organization.constants.permissions import (
    BrandingPermissions,
)
from apps.organization.models.branding import (
    Branding,
)
from apps.organization.selectors.branding import (
    BrandingSelector,
)
from apps.organization.services.branding import (
    BrandingService,
)


class BrandingViewSet(OrganizationEntityViewSet):
    """
    API endpoint for Branding.
    """

    queryset = Branding.objects.all()

    selector_class = BrandingSelector
    service_class = BrandingService

    filterset_class = BrandingFilterSet

    serializer_map = {
        "list": BrandingListSerializer,
        "retrieve": BrandingDetailSerializer,
        "create": BrandingCreateSerializer,
        "update": BrandingUpdateSerializer,
        "partial_update": BrandingUpdateSerializer,
    }

    permission_map = {
        "list": (BrandingPermissions.VIEW,),
        "retrieve": (BrandingPermissions.VIEW,),
        "create": (BrandingPermissions.CREATE,),
        "update": (BrandingPermissions.UPDATE,),
        "partial_update": (BrandingPermissions.UPDATE,),
        "destroy": (BrandingPermissions.DELETE,),
    }
