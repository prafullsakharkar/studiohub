"""
Department API viewset.
"""

from apps.core.api.pagination import StandardPagination
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
from apps.organization.api.viewsets.compat import IdOrCodeDetailMixin
from apps.organization.api.viewsets.context import OrganizationContextMixin
from apps.organization.constants.permissions import DepartmentPermissions
from apps.organization.selectors.department import DepartmentSelector
from apps.organization.services.department import DepartmentService
from apps.organization.api.viewsets.clone_master import CloneMasterMixin
from apps.organization.services.clone_master import normalize_code
from apps.masterdata.models.platform import PlatformDepartment
from apps.organization.models import Department


class DepartmentViewSet(
    CloneMasterMixin,
    OrganizationContextMixin,
    IdOrCodeDetailMixin,
    OrganizationEntityViewSet,  # pyright: ignore[reportMissingTypeArgument]
):

    selector_class = DepartmentSelector
    service_class = DepartmentService
    filterset_class = DepartmentFilterSet

    clone_source_model = PlatformDepartment
    clone_target_model = Department
    clone_label = "Master Departments"

    @staticmethod
    def clone_build_kwargs(master):
        return {
            "name": master.name,
            "code": normalize_code(master.code, master.name),
            "description": master.description or "",
            "department_type": getattr(master, "department_type", "") or "creative",
            "color": getattr(master, "color", "") or "",
            "software_stack": getattr(master, "software_stack", []) or [],
            "capacity_hours_weekly": getattr(master, "capacity_hours_weekly", 0) or 0,
        }

    serializer_map = {
        "list": DepartmentListSerializer,
        "retrieve": DepartmentDetailSerializer,
        "create": DepartmentCreateSerializer,
        "update": DepartmentUpdateSerializer,
        "partial_update": DepartmentUpdateSerializer,
    }

    pagination_class = StandardPagination

    permission_map = {
        "list": (DepartmentPermissions.VIEW,),
        "retrieve": (DepartmentPermissions.VIEW,),
        "create": (DepartmentPermissions.CREATE,),
        "update": (DepartmentPermissions.UPDATE,),
        "partial_update": (DepartmentPermissions.UPDATE,),
        "destroy": (DepartmentPermissions.DELETE,),
        "clone_master": (DepartmentPermissions.CREATE,),
    }