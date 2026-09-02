from apps.core.api.pagination import StandardPagination
from apps.production.api.filtersets.project import ProjectFilterSet
from apps.production.api.serializers.project.create import ProjectCreateSerializer
from apps.production.api.serializers.project.detail import ProjectDetailSerializer
from apps.production.api.serializers.project.list import ProjectListSerializer
from apps.production.api.serializers.project.update import ProjectUpdateSerializer
from apps.production.api.viewsets.base import ProductionEntityViewSet
from apps.production.constants.permissions import ProjectPermissions
from apps.production.selectors.project import ProjectSelector
from apps.production.services.project import ProjectService


class ProjectViewSet(ProductionEntityViewSet):
    selector_class = ProjectSelector
    service_class = ProjectService
    pagination_class = StandardPagination
    filterset_class = ProjectFilterSet

    serializer_map = {
        "list": ProjectListSerializer,
        "retrieve": ProjectDetailSerializer,
        "create": ProjectCreateSerializer,
        "update": ProjectUpdateSerializer,
        "partial_update": ProjectUpdateSerializer,
    }

    permission_map = {
        "list": (ProjectPermissions.VIEW,),
        "retrieve": (ProjectPermissions.VIEW,),
        "create": (ProjectPermissions.CREATE,),
        "update": (ProjectPermissions.UPDATE,),
        "partial_update": (ProjectPermissions.UPDATE,),
        "destroy": (ProjectPermissions.DELETE,),
    }

    search_fields = ("name", "code", "description")
    ordering_fields = ("name", "code", "created_at", "status")
