from apps.core.api.viewsets import ServiceModelViewSet
from apps.organization.api.filtersets import OrganizationFilterSet
from apps.organization.api.serializers.organization import (
    OrganizationCreateSerializer,
    OrganizationDetailSerializer,
    OrganizationListSerializer,
    OrganizationUpdateSerializer,
)
from apps.organization.constants import OrganizationPermissions
from apps.organization.selectors import OrganizationSelector
from apps.organization.services import OrganizationService


class OrganizationViewSet(ServiceModelViewSet):
    """
    Organization API.
    """

    selector_class = OrganizationSelector

    service_class = OrganizationService

    filterset_class = OrganizationFilterSet

    serializer_map = {
        "list": OrganizationListSerializer,
        "retrieve": OrganizationDetailSerializer,
        "create": OrganizationCreateSerializer,
        "update": OrganizationUpdateSerializer,
        "partial_update": OrganizationUpdateSerializer,
    }

    permission_map = {
        "list": (OrganizationPermissions.VIEW,),
        "retrieve": (OrganizationPermissions.VIEW,),
        "create": (OrganizationPermissions.CREATE,),
        "update": (OrganizationPermissions.UPDATE,),
        "partial_update": (OrganizationPermissions.UPDATE,),
        "destroy": (OrganizationPermissions.DELETE,),
    }
