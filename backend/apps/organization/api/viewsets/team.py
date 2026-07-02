from apps.organization.api.filtersets.team import TeamFilterSet
from apps.organization.api.serializers.team.create import TeamCreateSerializer
from apps.organization.api.serializers.team.detail import TeamDetailSerializer
from apps.organization.api.serializers.team.list import TeamListSerializer
from apps.organization.api.serializers.team.update import TeamUpdateSerializer
from apps.organization.api.viewsets.base import (
    OrganizationEntityViewSet,
)
from apps.organization.constants.permissions import TeamPermissions
from apps.organization.models.team import Team
from apps.organization.selectors.team import TeamSelector
from apps.organization.services.team import TeamService


class TeamViewSet(OrganizationEntityViewSet):
    """
    API endpoint for Team entity.
    """

    # -----------------------------
    # Core wiring
    # -----------------------------
    queryset = Team.objects.all()

    selector_class = TeamSelector
    service_class = TeamService
    filterset_class = TeamFilterSet

    # -----------------------------
    # Serializer mapping
    # -----------------------------
    serializer_map = {
        "list": TeamListSerializer,
        "retrieve": TeamDetailSerializer,
        "create": TeamCreateSerializer,
        "update": TeamUpdateSerializer,
        "partial_update": TeamUpdateSerializer,
    }

    # -----------------------------
    # Permission mapping
    # -----------------------------
    permission_map = {
        "list": (TeamPermissions.VIEW,),
        "retrieve": (TeamPermissions.VIEW,),
        "create": (TeamPermissions.CREATE,),
        "update": (TeamPermissions.UPDATE,),
        "partial_update": (TeamPermissions.UPDATE,),
        "destroy": (TeamPermissions.DELETE,),
    }
