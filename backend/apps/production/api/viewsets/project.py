from django.db import transaction
from django.http import HttpResponse
from django.utils.http import content_disposition_header
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from apps.core.api.pagination import StandardPagination
from apps.identity.models import Role
from apps.production.api.filtersets.project import ProjectFilterSet
from apps.production.api.serializers.grade import (
    GradeImportRequestSerializer,
    GradeImportSerializer,
)
from apps.production.api.serializers.project.create import ProjectCreateSerializer
from apps.production.api.serializers.project.detail import ProjectDetailSerializer
from apps.production.api.serializers.project.list import ProjectListSerializer
from apps.production.api.serializers.project.update import ProjectUpdateSerializer
from apps.production.api.serializers.review_media import (
    ReviewCopiesKeepSerializer,
    ReviewCopiesKeptSerializer,
    ReviewCopiesRemadeSerializer,
    ReviewCopiesSerializer,
)
from apps.production.api.viewsets.base import ProductionEntityViewSet
from apps.production.constants import ProjectWorkflowType
from apps.production.constants.permissions import ProjectPermissions, ShotPermissions
from apps.production.models import Episode, Shot
from apps.production.permissions.checks import has_permission_code
from apps.production.selectors.base import ProductionBaseSelector
from apps.production.selectors.dashboard import ProjectDashboardSelector
from apps.production.selectors.delivery_figures import delivery_figures
from apps.production.selectors.project import ProjectSelector
from apps.production.selectors.review_media import ReviewMediaSelector
from apps.production.services.grade_export import GradeExportService
from apps.production.services.grade_import import GradeImportService
from apps.production.services.project import ProjectService
from apps.production.services.project_scoped import ProjectMembershipService
from apps.production.services.review_media import ReviewMediaService
from apps.production.validators.partners import refuse_partners_in_use


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
        # Same as episodes and sequences: DELETE already archives, so archive needs the delete permission.
        "archive": (ProjectPermissions.DELETE,),
        "review_copies": (ProjectPermissions.VIEW,),
        "remake_review_copies": (ProjectPermissions.UPDATE,),
        "keep_review_copies": (ProjectPermissions.UPDATE,),
        # RP-20 (C-RP-54): grades are the shots', so importing them needs the shot write
        "import_grades": (ShotPermissions.UPDATE,),
        # RP-27 (C-RP-62, Q-RP-123): the grades of the shots the caller reads
        "export_grades": (ShotPermissions.VIEW,),
        # check_existence / existence_check stay unmapped on purpose: this viewset has no
        # _existence_items_from_request, so mapping them would turn a 403 into a 500.
    }

    search_fields = ("name", "code", "description", "client_name")
    ordering_fields = ("name", "code", "created_at", "status")

    def _guard_budget(self, data):
        """
        Writing ``budget_usd`` needs ``project.view_budget`` (docs/sync CR-55): 403, nothing saved.

        Any write that names the field is refused, whatever its value, so the answer says nothing
        about the stored budget. A write that leaves it out is unaffected.
        """
        if "budget_usd" in data and not has_permission_code(
            self.request, ProjectPermissions.VIEW_BUDGET
        ):
            raise PermissionDenied(f"Setting budget_usd requires {ProjectPermissions.VIEW_BUDGET}.")

    def check_update(self, instance, data):
        self._guard_budget(data)
        # CR-60: the client cannot change, nor a vendor leave, while a record of the project still names it.
        refuse_partners_in_use(instance, data)
        super().check_update(instance, data)

    def perform_create(self, serializer):
        """Create the project, the creator's membership and the first episode, or nothing."""
        validated = serializer.validated_data
        self._guard_budget(validated if isinstance(validated, dict) else {})
        with transaction.atomic():
            super().perform_create(serializer)
            self._add_creator_membership(serializer.instance)
            self._bootstrap_initial_episode(serializer.instance)

    def _add_creator_membership(self, project):
        """
        The creator becomes a member, so they can see what they just created.

        Platform admins see every project anyway and get no membership. The
        role label is a display value: authorization comes from the permission
        codes (``ProjectMembership.role_ref`` is not consulted yet, Q9). What the
        creator can do beyond what their global role allows is managing the
        project's members, decided by ``created_by`` and not by this role (D-14).
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

    def _require_full_access(self, project):
        """Whole-project figures are for internal members: an external member gets a 404."""
        if not ProductionBaseSelector.user_has_full_project_access(
            request=self.request, project=project
        ):
            raise NotFound("Project not found.")

    @action(detail=True, methods=["get"], url_path="statistics")
    def statistics(self, request, *args, **kwargs):
        """Frontend contract: GET /api/v1/projects/{id}/statistics/."""
        instance = self.get_object()
        self._require_full_access(instance)
        return Response(
            ProjectSelector.summary_counts(
                instance,
                include_deliveries=has_permission_code(request, delivery_figures().view_permission),
            )
        )

    @action(detail=True, methods=["get"], url_path="dashboard")
    def dashboard(self, request, *args, **kwargs):
        """Frontend contract: GET /api/v1/projects/{id}/dashboard/.

        Consolidated project-scoped telemetry for the Project Command
        Center. Detail lookup accepts UUID or code (case-insensitive);
        unknown projects 404 via ``get_object``.
        """
        instance = self.get_object()
        self._require_full_access(instance)
        return Response(
            ProjectDashboardSelector.build(
                instance,
                include_deliveries=has_permission_code(request, delivery_figures().view_permission),
                include_budget=has_permission_code(request, ProjectPermissions.VIEW_BUDGET),
            )
        )

    @extend_schema(request=None, responses={200: ReviewCopiesSerializer})
    @action(detail=True, methods=["get"], url_path="review-copies")
    def review_copies(self, request, *args, **kwargs):
        """The review copies made with other settings than the project has now (C-RP-38, C-RP-42)."""
        instance = self.get_object()
        self._require_full_access(instance)
        return Response(ReviewCopiesSerializer(ReviewMediaSelector.copies_summary(instance)).data)

    @extend_schema(request=None, responses={200: ReviewCopiesRemadeSerializer})
    @action(detail=True, methods=["post"], url_path="review-copies/remake")
    def remake_review_copies(self, request, *args, **kwargs):
        """Remake every differing copy that can be remade (C-RP-38; sequences, C-RP-41)."""
        instance = self.get_object()
        self._require_full_access(instance)
        counts = ReviewMediaService.remake_differing(actor=request.user, project=instance)
        return Response(ReviewCopiesRemadeSerializer(counts).data)

    @extend_schema(request=ReviewCopiesKeepSerializer, responses={200: ReviewCopiesKeptSerializer})
    @action(detail=True, methods=["post"], url_path="review-copies/keep")
    def keep_review_copies(self, request, *args, **kwargs):
        """Keep differing copies that cannot be remade as they are (C-RP-43)."""
        instance = self.get_object()
        self._require_full_access(instance)
        body = ReviewCopiesKeepSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        kept = ReviewMediaService.keep(
            actor=request.user, project=instance, ids=body.validated_data["review_media_ids"]
        )
        return Response(ReviewCopiesKeptSerializer(kept).data)

    @extend_schema(
        request={"multipart/form-data": GradeImportRequestSerializer},
        responses={200: GradeImportSerializer},
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="grades/import",
        parser_classes=[MultiPartParser, FormParser],
    )
    def import_grades(self, request, *args, **kwargs):
        """Shot grades from a client's .cc, .ccc or .cdl file; a dry run unless ``dry_run`` is false
        (RP-20, C-RP-54). Only the shots the caller may update are matched (CR-46)."""
        instance = self.get_object()
        body = GradeImportRequestSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        answer = GradeImportService.import_file(
            actor=request.user,
            project=instance,
            upload=body.validated_data["file"],
            dry_run=body.validated_data["dry_run"],
            scope=ProductionBaseSelector.scope_by_project_membership(
                Shot.objects.all(), request=request
            ),
        )
        return Response(GradeImportSerializer(answer).data)

    @extend_schema(
        parameters=[OpenApiParameter("sequence_id", OpenApiTypes.STR, required=False)],
        responses={
            (200, "application/xml"): OpenApiResponse(
                OpenApiTypes.BINARY, description="A ColorCorrectionCollection (.ccc)."
            )
        },
    )
    @action(detail=True, methods=["get"], url_path="grades/export")
    def export_grades(self, request, *args, **kwargs):
        """The graded shots the caller reads as one .ccc file, or one sequence's (RP-27, C-RP-62);
        each export is an audit row."""
        instance = self.get_object()
        name, data = GradeExportService.export(
            actor=request.user,
            project=instance,
            scope=ProductionBaseSelector.scope_by_project_membership(
                Shot.objects.all(), request=request
            ),
            sequence_id=request.query_params.get("sequence_id") or None,
            request=request,
        )
        response = HttpResponse(data, content_type="application/xml; charset=utf-8")
        response["Content-Disposition"] = content_disposition_header(True, name)
        response["Cache-Control"] = "no-store"
        return response
