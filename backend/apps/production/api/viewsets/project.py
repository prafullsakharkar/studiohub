from django.db import transaction
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.api.pagination import StandardPagination
from apps.identity.models import Role
from apps.production.api.filtersets.project import ProjectFilterSet
from apps.production.api.serializers.project.create import ProjectCreateSerializer
from apps.production.api.serializers.project.detail import ProjectDetailSerializer
from apps.production.api.serializers.project.list import ProjectListSerializer
from apps.production.api.serializers.project.update import ProjectUpdateSerializer
from apps.production.api.viewsets.base import ProductionEntityViewSet
from apps.production.constants import ProjectWorkflowType
from apps.production.constants.permissions import ProjectPermissions
from apps.production.models import Episode
from apps.production.selectors.base import ProductionBaseSelector
from apps.production.selectors.dashboard import ProjectDashboardSelector
from apps.production.selectors.project import ProjectSelector
from apps.production.services.project import ProjectService
from apps.production.services.project_scoped import ProjectMembershipService


class ProjectViewSet(ProductionEntityViewSet):  # pyright: ignore[reportMissingTypeArgument]
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
        "statistics": (ProjectPermissions.VIEW,),
        "dashboard": (ProjectPermissions.VIEW,),
        "archived": (ProjectPermissions.VIEW,),
        "restore": (ProjectPermissions.UPDATE,),
    }

    search_fields = ("name", "code", "description", "client_name")
    ordering_fields = ("name", "code", "created_at", "status")

    def perform_create(self, serializer):
        """Create the project, the creator's membership and the first episode, or nothing."""
        with transaction.atomic():
            super().perform_create(serializer)
            self._add_creator_membership(serializer.instance)
            self._bootstrap_initial_episode(serializer.instance)

    def _add_creator_membership(self, project):
        """
        The creator becomes a member, so they can see what they just created.

        Platform admins see every project anyway and get no membership. The
        role label is a display value: authorization comes from the permission
        codes (``ProjectMembership.role_ref`` is not consulted yet, Q9).
        """
        user = self.request.user
        if ProductionBaseSelector.is_platform_admin(user):
            return
        role_ref = Role.objects.filter(code="production-admin", is_deleted=False).first()
        ProjectMembershipService.add_member(
            project=project, user=user, role="Production Admin", role_ref=role_ref
        )

    def _bootstrap_initial_episode(self, project):
        """Episodic projects start with an initial EP101 episode."""
        if project is None or project.workflow_type != ProjectWorkflowType.EPISODIC:
            return
        Episode.objects.create(
            project=project,
            code="EP101",
            name="Episode 1",
            season_number=1,
            episode_number=1,
        )

    @action(detail=True, methods=["get"], url_path="statistics")
    def statistics(self, request, *args, **kwargs):
        """Frontend contract: GET /api/v1/projects/{id}/statistics/."""
        instance = self.get_object()
        return Response(ProjectSelector.summary_counts(instance))

    @action(detail=True, methods=["get"], url_path="dashboard")
    def dashboard(self, request, *args, **kwargs):
        """Frontend contract: GET /api/v1/projects/{id}/dashboard/.

        Consolidated project-scoped telemetry for the Project Command
        Center. Detail lookup accepts UUID or code (case-insensitive);
        unknown projects 404 via ``get_object``.
        """
        instance = self.get_object()
        return Response(ProjectDashboardSelector.build(instance))
