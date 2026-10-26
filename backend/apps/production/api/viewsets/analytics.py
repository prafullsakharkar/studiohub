from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.production.selectors.base import ProductionBaseSelector


class AnalyticsKpisView(APIView):
    """
    Real aggregates computed from production models, narrowed to the caller's
    project memberships (platform admins see every project).

    Response matches the frontend ``ProductionKpis`` contract
    (``src/types/analytics.ts``). Fields with no data source yet
    (render-farm telemetry, render-time averages) return ``null`` so the UI
    renders an honest unknown instead of illustrative literals.
    """

    permission_classes = (IsAuthenticated,)

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        from apps.production.constants.project import ProjectStatus
        from apps.production.constants.shot import ShotStatus
        from apps.production.models import Project, Shot, Task

        def scoped(qs):
            return ProductionBaseSelector.scope_by_project_membership(qs, request=request)

        shots = scoped(Shot.objects.all())
        total = shots.count()
        approved = shots.filter(status=ShotStatus.APPROVED).count()
        in_progress = shots.filter(status=ShotStatus.IN_PROGRESS).count()
        pending_review = shots.filter(status=ShotStatus.PENDING_REVIEW).count()
        active_projects = (
            scoped(Project.objects.filter(is_deleted=False))
            .exclude(status=ProjectStatus.ARCHIVED)
            .count()
        )
        active_artists = (
            scoped(Task.objects.filter(is_deleted=False))
            .exclude(assignee__isnull=True)
            .values("assignee")
            .distinct()
            .count()
        )
        used_tb, quota_tb = _storage_figures()
        return Response(
            {
                "total_active_projects": active_projects,
                "total_shots": total,
                "approved_shots": approved,
                "pending_review_shots": pending_review,
                "in_progress_shots": in_progress,
                "approval_rate_percentage": round(approved / total * 100, 1) if total else 0.0,
                "active_artists": active_artists,
                "storage_usage_tb": used_tb,
                "storage_quota_tb": quota_tb,
                "render_nodes_busy": None,
                "render_nodes_total": None,
                "average_render_time_mins": None,
            }
        )


def _storage_figures():
    """Storage telemetry came from the organization billing account, which no
    longer exists. Returns zeros until a platform telemetry source lands."""
    return 0, 0


class AnalyticsDepartmentsView(APIView):
    """Per-department task aggregates computed from the caller's member projects."""

    permission_classes = (IsAuthenticated,)

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        from django.db.models import Count, Q

        from apps.production.constants.task import TaskStatus
        from apps.production.models import Task

        base = ProductionBaseSelector.scope_by_project_membership(Task.objects.all(), request=request)
        rows = (
            base.exclude(department="")
            .values("department")
            .annotate(
                total_tasks=Count("id"),
                completed_tasks=Count("id", filter=Q(status=TaskStatus.APPROVED)),
            )
            .order_by("-total_tasks")
        )
        return Response(
            [
                {
                    "department": row["department"],
                    "total_tasks": row["total_tasks"],
                    "completed_tasks": row["completed_tasks"],
                    "percentage": round(row["completed_tasks"] / row["total_tasks"] * 100)
                    if row["total_tasks"]
                    else 0,
                }
                for row in rows
            ]
        )
