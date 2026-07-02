from apps.organization.api.filtersets.department import DepartmentFilterSet
from apps.organization.api.serializers.department import (
    DepartmentCreateSerializer,
    DepartmentDetailSerializer,
    DepartmentListSerializer,
    DepartmentUpdateSerializer,
)
from apps.organization.api.viewsets.base import (
    OrganizationEntityViewSet,
)
from apps.organization.constants.permissions import DepartmentPermissions
from apps.organization.selectors.department import DepartmentSelector
from apps.organization.services.department import DepartmentService


class DepartmentViewSet(
    OrganizationEntityViewSet,
):

    selector_class = DepartmentSelector

    service_class = DepartmentService

    filterset_class = DepartmentFilterSet

    serializer_map = {
        "list": DepartmentListSerializer,
        "retrieve": DepartmentDetailSerializer,
        "create": DepartmentCreateSerializer,
        "update": DepartmentUpdateSerializer,
        "partial_update": DepartmentUpdateSerializer,
    }

    permission_map = {
        "list": (DepartmentPermissions.VIEW,),
        "retrieve": (DepartmentPermissions.VIEW,),
        "create": (DepartmentPermissions.CREATE,),
        "update": (DepartmentPermissions.UPDATE,),
        "partial_update": (DepartmentPermissions.UPDATE,),
        "destroy": (DepartmentPermissions.DELETE,),
    }
