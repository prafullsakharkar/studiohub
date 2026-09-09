"""
Project-scoped nested API for the frontend contract.

Mount: /api/organizations/<org>/projects/<project>/...

Matches ``projectScopedApi.ts`` (no /v1/, slashless sub-paths):

    members (GET list + POST create)
    summary | sequences | shots | tasks | assets | versions | reviews
    editorial | notes (GET list + POST create) | deliveries
    schedule | resources | pipeline | files | activity

``<org>`` accepts id/code/slug; ``<project>`` accepts id/code (both scoped
to the organization; unknown values 404 with ``{detail}``).

Entity lists reuse the flat viewsets' selector + filterset + search +
ordering + pagination machinery so shapes and query params are identical to
the top-level endpoints, additionally constrained to the URL project.
Authorization: authenticated users with an organization or project
membership (staff/superuser included); otherwise 403. The organization
boundary is always enforced server-side.
"""

from __future__ import annotations

import contextlib
from datetime import date, timedelta
from types import SimpleNamespace
from typing import Any, ClassVar, cast

from django.http import Http404
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.filters.activity import ActivityFilter
from apps.audit.serializers.activity import ActivitySerializer
from apps.core.api.pagination import StandardPagination
from apps.core.permissions.base import IsAuthenticatedPermission
from apps.deliveries.api.serializers.delivery import DeliveryListSerializer
from apps.deliveries.selectors.delivery import DeliverySelector
from apps.organization.models import Organization, OrganizationMembership
from apps.production.api.serializers.asset.list import AssetListSerializer
from apps.production.api.serializers.editorial import EditorialCutSerializer
from apps.production.api.serializers.media.list import MediaListSerializer
from apps.production.api.serializers.membership import (
    ProjectMembershipCreateSerializer,
    ProjectMembershipSerializer,
)
from apps.production.api.serializers.project.detail import ProjectDetailSerializer
from apps.production.api.serializers.project_note import (
    ProjectNoteCreateSerializer,
    ProjectNoteSerializer,
)
from apps.production.api.serializers.review.list import ReviewListSerializer
from apps.production.api.serializers.sequence.list import SequenceListSerializer
from apps.production.api.serializers.shot.list import ShotListSerializer
from apps.production.api.serializers.task.list import TaskListSerializer
from apps.production.api.serializers.version.list import VersionListSerializer
from apps.production.api.viewsets.asset import AssetViewSet
from apps.production.api.viewsets.media import MediaViewSet
from apps.production.api.viewsets.review import ReviewViewSet
from apps.production.api.viewsets.sequence import SequenceViewSet
from apps.production.api.viewsets.shot import ShotViewSet
from apps.production.api.viewsets.task import TaskViewSet
from apps.production.api.viewsets.version import VersionViewSet
from apps.production.models import (
    Project,
    ProjectMembership,
    Task,
    Workflow,
)
from apps.production.selectors.asset import AssetSelector
from apps.production.selectors.media import MediaSelector
from apps.production.selectors.project import ProjectSelector
from apps.production.selectors.project_scoped import (
    EditorialCutSelector,
    ProjectMembershipSelector,
    ProjectNoteSelector,
)
from apps.production.selectors.review import ReviewSelector
from apps.production.selectors.sequence import SequenceSelector
from apps.production.selectors.shot import ShotSelector
from apps.production.selectors.task import TaskSelector
from apps.production.selectors.version import VersionSelector
from apps.production.services.project_scoped import (
    ProjectMembershipService,
    ProjectNoteService,
)

# Contractual display constants mirrored from the frontend mock
# (pipeline tab scaffolding; project fields themselves are real data).
DCC_INTEGRATIONS = [
    {"name": "Foundry Nuke Studio", "version": "15.1v2", "plugin": "StudioHub NukeBridge 2.4"},
    {"name": "SideFX Houdini", "version": "20.5", "plugin": "StudioHub SolarisUSD 3.1"},
    {"name": "Autodesk Maya", "version": "2025", "plugin": "StudioHub MayaSync 2.0"},
    {"name": "Epic Unreal Engine", "version": "5.4.3", "plugin": "StudioHub LiveLink 1.8"},
]
USD_SCHEMA_VERSION = "23.11"
OCIO_CONFIG = "/studio/configs/aces_1.2/config.ocio"

# Contractual schedule template: phase names mirror the frontend mock;
# dates interpolate the project's real start/delivery dates.
SCHEDULE_PHASES = [
    "Principal Turnover",
    "Post-Viz / Layout Approval",
    "50% Dailies Screening",
    "Final Comp Picture Lock",
    "Master DCI Delivery",
]


class ProjectScopeMixin:
    """Resolve <org>/<project> from the URL and enforce membership gating."""

    organization_url_kwarg = "organization_id"
    project_url_kwarg = "project_id"

    organization: Any = None
    project: Any = None
    # Mixin contract: provided by the APIView this mixin is combined with.
    # Annotations only, no runtime effect.
    request: ClassVar[Any]

    def initial(self, request, *args, **kwargs):
        # reportAttributeAccessIssue: super() is the combined APIView.
        super().initial(request, *args, **kwargs)  # pyright: ignore[reportAttributeAccessIssue]
        self.organization = self._resolve_organization(kwargs.get(self.organization_url_kwarg))
        self.project = self._resolve_project(
            self.organization, kwargs.get(self.project_url_kwarg)
        )
        request.organization = self.organization
        request.membership = self._resolve_membership(request)
        request._org_context_resolved = True
        if not self._has_access(request):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied(
                "You are not a member of this project or organization."
            )

    @staticmethod
    def _resolve_organization(lookup):
        from django.core.exceptions import ValidationError as DjangoValidationError

        if not lookup:
            raise Http404("Organization not found.")
        org = None
        try:
            org = Organization.objects.filter(id=lookup, is_deleted=False).first()
        except (ValueError, TypeError, DjangoValidationError):
            org = None
        if org is None:
            from django.db.models import Q

            org = (
                Organization.objects.filter(is_deleted=False)
                .filter(Q(code__iexact=lookup) | Q(slug__iexact=lookup))
                .first()
            )
        if org is None:
            raise Http404(f"Project {lookup} not found in organization.")
        return org

    @staticmethod
    def _resolve_project(organization, lookup):
        from django.core.exceptions import ValidationError as DjangoValidationError

        if not lookup:
            raise Http404("Project not found.")
        project = None
        try:
            project = Project.objects.filter(
                organization=organization, id=lookup
            ).first()
        except (ValueError, TypeError, DjangoValidationError):
            project = None
        if project is None:
            project = Project.objects.filter(
                organization=organization, code__iexact=lookup
            ).first()
        if project is None:
            raise Http404(f"Project {lookup} not found in organization.")
        return project

    def _resolve_membership(self, request):
        user = getattr(request, "user", None)
        if user is None or not getattr(user, "is_authenticated", False):
            return None
        return (
            OrganizationMembership.objects.filter(
                user=user, organization=self.organization, is_deleted=False
            )
            .select_related("role")
            .first()
        )

    def _has_access(self, request):
        user = getattr(request, "user", None)
        if user is None or not getattr(user, "is_authenticated", False):
            return False
        if getattr(user, "is_staff", False) or getattr(user, "is_superuser", False):
            return True
        if getattr(request, "membership", None) is not None:
            return True
        return ProjectMembership.objects.filter(
            organization=self.organization,
            project=self.project,
            user=user,
            is_deleted=False,
        ).exists()

class ProjectScopedAPIView(ProjectScopeMixin, APIView):
    permission_classes = (IsAuthenticatedPermission,)

    # -- shared list machinery -------------------------------------------
    # Reuses the flat viewsets' filterset + search + ordering + pagination
    # so project-scoped lists behave identically to the top-level endpoints.

    def _entity_list(
        self,
        *,
        selector_cls,
        serializer_cls,
        filterset_cls=None,
        filterset_fields=None,
        search_fields=(),
        ordering_fields=(),
        ordering=None,
    ):
        from django.db.models import QuerySet as DjangoQuerySet

        qs: DjangoQuerySet[Any] = selector_cls.get_queryset(
            request=self.request, view=self
        ).filter(project=self.project)
        shim = cast(
            Any,
            SimpleNamespace(
                filterset_class=filterset_cls,
                filterset_fields=filterset_fields,
                search_fields=search_fields,
                ordering_fields=ordering_fields,
                ordering=ordering,
            ),
        )
        qs = DjangoFilterBackend().filter_queryset(self.request, qs, shim)
        qs = SearchFilter().filter_queryset(self.request, qs, shim)
        qs = OrderingFilter().filter_queryset(self.request, qs, shim)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, self.request, view=self)
        serializer = serializer_cls(
            page if page is not None else qs,
            many=True,
            context={"request": self.request},
        )
        if page is not None:
            return paginator.get_paginated_response(serializer.data)
        return Response(serializer.data)


# ----------------------------------------------------------------------
# Members
# ----------------------------------------------------------------------


class ProjectMembersView(ProjectScopedAPIView):
    """GET {count, results[]} + POST create (201, 200 when already a member)."""

    def get(self, request, *args, **kwargs):
        qs = (
            ProjectMembershipSelector.get_queryset(request=request, view=self)
            .filter(organization=self.organization, project=self.project)
            .select_related("user", "project")
            .order_by("user__email")
        )
        members = list(qs)
        data = ProjectMembershipSerializer(
            members, many=True, context={"request": request}
        ).data
        return Response({"count": len(data), "results": data})

    def post(self, request, *args, **kwargs):
        from rest_framework import status as http_status

        serializer = ProjectMembershipCreateSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        payload = cast(dict[str, Any], serializer.validated_data)
        user = ProjectMembershipService.resolve_user(
            user_ref=payload["userId"] or payload["user_id"] or "",
            email=payload["email"] or "",
        )
        if user is None:
            return Response(
                {"detail": "User not found in organization."},
                status=http_status.HTTP_404_NOT_FOUND,
            )
        roles = payload.get("roles") or [payload.get("role") or "Artist"]
        membership, created = ProjectMembershipService.add_member(
            organization=self.organization,
            project=self.project,
            user=user,
            role=payload.get("role") or "Artist",
            roles=roles,
            scope=payload.get("scope") or "PROJECT",
        )
        data = ProjectMembershipSerializer(
            membership, context={"request": request}
        ).data
        return Response(
            data,
            status=http_status.HTTP_201_CREATED if created else http_status.HTTP_200_OK,
        )


# ----------------------------------------------------------------------
# Summary
# ----------------------------------------------------------------------


class ProjectSummaryView(ProjectScopedAPIView):
    def get(self, request, *args, **kwargs):
        project_data = ProjectDetailSerializer(
            self.project, context={"request": request}
        ).data
        return Response(
            {
                "project": project_data,
                "counts": ProjectSelector.summary_counts(self.project),
                "organization_id": str(self.organization.id),
                "project_id": str(self.project.id),
            }
        )


# ----------------------------------------------------------------------
# Entity lists
# ----------------------------------------------------------------------


class _SequenceListView(ProjectScopedAPIView):
    def get(self, request, *args, **kwargs):
        return self._entity_list(
            selector_cls=SequenceSelector,
            serializer_cls=SequenceListSerializer,
            filterset_cls=getattr(SequenceViewSet, "filterset_class", None),
            search_fields=getattr(SequenceViewSet, "search_fields", ()),
            ordering_fields=getattr(SequenceViewSet, "ordering_fields", ()),
        )


class _ShotListView(ProjectScopedAPIView):
    def get(self, request, *args, **kwargs):
        return self._entity_list(
            selector_cls=ShotSelector,
            serializer_cls=ShotListSerializer,
            filterset_cls=getattr(ShotViewSet, "filterset_class", None),
            search_fields=getattr(ShotViewSet, "search_fields", ()),
            ordering_fields=getattr(ShotViewSet, "ordering_fields", ()),
        )


class _TaskListView(ProjectScopedAPIView):
    def get(self, request, *args, **kwargs):
        return self._entity_list(
            selector_cls=TaskSelector,
            serializer_cls=TaskListSerializer,
            filterset_cls=getattr(TaskViewSet, "filterset_class", None),
            search_fields=getattr(TaskViewSet, "search_fields", ()),
            ordering_fields=getattr(TaskViewSet, "ordering_fields", ()),
        )


class _AssetListView(ProjectScopedAPIView):
    def get(self, request, *args, **kwargs):
        return self._entity_list(
            selector_cls=AssetSelector,
            serializer_cls=AssetListSerializer,
            filterset_cls=getattr(AssetViewSet, "filterset_class", None),
            search_fields=getattr(AssetViewSet, "search_fields", ()),
            ordering_fields=getattr(AssetViewSet, "ordering_fields", ()),
        )


class _VersionListView(ProjectScopedAPIView):
    def get(self, request, *args, **kwargs):
        return self._entity_list(
            selector_cls=VersionSelector,
            serializer_cls=VersionListSerializer,
            filterset_cls=getattr(VersionViewSet, "filterset_class", None),
            search_fields=getattr(VersionViewSet, "search_fields", ()),
            ordering_fields=getattr(VersionViewSet, "ordering_fields", ()),
        )


class _ReviewListView(ProjectScopedAPIView):
    def get(self, request, *args, **kwargs):
        return self._entity_list(
            selector_cls=ReviewSelector,
            serializer_cls=ReviewListSerializer,
            filterset_cls=getattr(ReviewViewSet, "filterset_class", None),
            search_fields=getattr(ReviewViewSet, "search_fields", ()),
            ordering_fields=getattr(ReviewViewSet, "ordering_fields", ()),
        )


ProjectSequencesView = _SequenceListView
ProjectShotsView = _ShotListView
ProjectTasksView = _TaskListView
ProjectAssetsView = _AssetListView
ProjectVersionsView = _VersionListView
ProjectReviewsView = _ReviewListView


class ProjectEditorialView(ProjectScopedAPIView):
    def get(self, request, *args, **kwargs):
        return self._entity_list(
            selector_cls=EditorialCutSelector,
            serializer_cls=EditorialCutSerializer,
            search_fields=("name", "code", "sequence_code"),
            ordering_fields=("code", "created_at"),
        )


class ProjectNotesView(ProjectScopedAPIView):
    def get(self, request, *args, **kwargs):
        return self._entity_list(
            selector_cls=ProjectNoteSelector,
            serializer_cls=ProjectNoteSerializer,
            search_fields=("subject", "body", "entity_code", "entity_name"),
            ordering_fields=("created_at", "priority", "status"),
            ordering=("-created_at",),
        )

    def post(self, request, *args, **kwargs):
        from rest_framework import status as http_status

        serializer = ProjectNoteCreateSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        validated = cast(dict[str, Any], serializer.validated_data)
        user = request.user if request.user.is_authenticated else None
        author_name = validated.get("author_name") or ""
        if not author_name and user is not None:
            profile = getattr(user, "profile", None)
            author_name = (
                getattr(profile, "display_name", "") if profile else ""
            ) or getattr(user, "email", "")
        validated["author_name"] = author_name
        note = ProjectNoteService.create_note(
            user=user,
            organization=self.organization,
            project=self.project,
            author=user,
            **validated,
        )
        data = ProjectNoteSerializer(note, context={"request": request}).data
        return Response(data, status=http_status.HTTP_201_CREATED)


class ProjectDeliveriesView(ProjectScopedAPIView):
    def get(self, request, *args, **kwargs):
        return self._entity_list(
            selector_cls=DeliverySelector,
            serializer_cls=DeliveryListSerializer,
            search_fields=("name", "code"),
            ordering_fields=("name", "created_at", "status"),
        )


class ProjectFilesView(ProjectScopedAPIView):
    def get(self, request, *args, **kwargs):
        return self._entity_list(
            selector_cls=MediaSelector,
            serializer_cls=MediaListSerializer,
            filterset_fields=getattr(MediaViewSet, "filterset_fields", None),
            search_fields=(
                "title",
                "code",
                "file_name",
                "name",
                "file_format",
                "category",
            ),
            ordering_fields=("created_at",),
        )


class ProjectActivityView(ProjectScopedAPIView):
    def get(self, request, *args, **kwargs):
        project_key = str(self.project.id)

        def _scoped(qs):
            return qs.filter(
                organization=self.organization, metadata__project_id=project_key
            )

        from apps.audit.selectors.activity import ActivitySelector

        qs = _scoped(
            ActivitySelector.get_queryset(request=self.request, view=self)
        )
        activity_filter = ActivityFilter(qs, data=self.request.query_params)
        qs = activity_filter.qs
        shim = cast(
            Any,
            SimpleNamespace(
                search_fields=(
                    "description",
                    "metadata__action",
                    "metadata__actionLabel",
                ),
                ordering_fields=("created_at",),
                ordering=("-created_at",),
            ),
        )
        qs = SearchFilter().filter_queryset(self.request, qs, shim)
        qs = OrderingFilter().filter_queryset(self.request, qs, shim)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, self.request, view=self)
        serializer = ActivitySerializer(
            page if page is not None else qs,
            many=True,
            context={"request": self.request},
        )
        if page is not None:
            return paginator.get_paginated_response(serializer.data)
        return Response(serializer.data)


# ----------------------------------------------------------------------
# Derived objects: schedule / resources / pipeline
# ----------------------------------------------------------------------


class ProjectScheduleView(ProjectScopedAPIView):
    def get(self, request, *args, **kwargs):
        project = self.project
        start = project.start_date or date.today()
        end = project.delivery_date or (start + timedelta(days=180))
        if end <= start:
            end = start + timedelta(days=180)
        span = (end - start).days
        today = date.today()
        milestones = []
        for index, name in enumerate(SCHEDULE_PHASES):
            point = start + timedelta(days=round(span * index / (len(SCHEDULE_PHASES) - 1)))
            if point < today:
                milestone_status = "Completed"
            elif index == 0 or (
                start + timedelta(days=round(span * (index - 1) / (len(SCHEDULE_PHASES) - 1)))
                < today
            ):
                milestone_status = "In Progress"
            else:
                milestone_status = "Pending"
            milestones.append(
                {
                    "id": f"m-{index + 1}",
                    "name": name,
                    "date": point.isoformat(),
                    "status": milestone_status,
                }
            )
        return Response(
            {
                "project_id": str(project.id),
                "start_date": start.isoformat(),
                "delivery_date": end.isoformat(),
                "milestones": milestones,
            }
        )


class ProjectResourcesView(ProjectScopedAPIView):
    def get(self, request, *args, **kwargs):
        tasks = (
            Task.objects.filter(organization=self.organization, project=self.project)
            .select_related("assignee")
            .all()
        )
        artists: dict[str, dict[str, Any]] = {}
        departments: set[str] = set()
        for task in tasks:
            if task.department:
                departments.add(task.department)
            if not task.assignee_id:
                continue
            key = str(task.assignee_id)
            existing = artists.get(key)
            if existing is None:
                profile = getattr(task.assignee, "profile", None)
                name = (
                    getattr(profile, "display_name", "") if profile else ""
                ) or getattr(task.assignee, "email", "")
                avatar = None
                if profile and getattr(profile, "avatar", None):
                    with contextlib.suppress(Exception):
                        avatar = profile.avatar.url
                existing = {
                    "id": key,
                    "name": name,
                    "avatar": avatar,
                    "role": task.department or "VFX Artist",
                    "task_count": 0,
                    "hours_logged": 0.0,
                }
                artists[key] = existing
            existing["task_count"] = int(existing.get("task_count") or 0) + 1
            logged = float(existing.get("hours_logged") or 0.0)
            with contextlib.suppress(TypeError, ValueError):
                logged += float(task.logged_hours or 0)
            existing["hours_logged"] = logged
        return Response(
            {
                "project_id": str(self.project.id),
                "total_artists": len(artists),
                "artists": list(artists.values()),
                "departments": sorted(departments),
            }
        )


class ProjectPipelineView(ProjectScopedAPIView):
    def get(self, request, *args, **kwargs):
        project = self.project
        workflow = (
            Workflow.objects.filter(organization=self.organization, project=project)
            .order_by("created_at")
            .first()
        )
        nodes = []
        if workflow is not None:
            nodes = workflow.nodes or []
        return Response(
            {
                "project_id": str(project.id),
                "color_space": project.color_space or "",
                "resolution": project.resolution or "",
                "fps": project.fps,
                "aspect_ratio": project.aspect_ratio or "",
                "pipeline_steps": nodes,
                "dcc_integrations": DCC_INTEGRATIONS,
                "usd_schema_version": USD_SCHEMA_VERSION,
                "ocio_config": OCIO_CONFIG,
            }
        )
