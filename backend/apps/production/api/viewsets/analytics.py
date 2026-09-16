from typing import Any

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


class DummySerializer(serializers.Serializer[Any]):
    pass


def _resolve_org(request):
    """Organization context or None (fail-closed callers render zeros)."""
    return getattr(request, "organization", None)


class AnalyticsKpisView(GenericAPIView):  # pyright: ignore[reportMissingTypeArgument]
    """
    Real aggregates computed from production models, org-scoped.

    Fields with no data source yet (render-farm telemetry, render-time
    averages) return ``null`` so the UI renders an honest unknown instead
    of illustrative literals.
    """

    permission_classes = (IsAuthenticated,)
    serializer_class = DummySerializer

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        from apps.production.constants.shot import ShotStatus
        from apps.production.models import Shot

        org = _resolve_org(request)
        shots = Shot.objects.filter(organization=org) if org is not None else Shot.objects.none()
        total = shots.count()
        approved = shots.filter(status=ShotStatus.APPROVED).count()
        in_progress = shots.filter(status=ShotStatus.IN_PROGRESS).count()
        pending_review = shots.filter(status=ShotStatus.PENDING_REVIEW).count()
        quota_tb, used_tb = _storage_figures(org)
        return Response(
            {
                "total_shots": total,
                "approved_shots": approved,
                "in_progress_shots": in_progress,
                "pending_review_shots": pending_review,
                "approval_rate_percentage": round(approved / total * 100, 1) if total else 0.0,
                "storage_usage_tb": used_tb,
                "quota_tb": quota_tb,
                "render_nodes_busy": None,
                "render_nodes_total": None,
                "avg_render_time_mins": None,
            }
        )


def _storage_figures(org):
    """(used_tb, quota_tb) from the org billing account; zeros when absent."""
    if org is None:
        return 0, 0
    try:
        from apps.organization.models import OrganizationBilling

        billing = OrganizationBilling.objects.filter(organization=org).first()
    except Exception:
        return 0, 0
    if billing is None:
        return 0, 0
    return billing.storage_used_tb or 0, billing.storage_quota_tb or 0


class AnalyticsDepartmentsView(GenericAPIView):  # pyright: ignore[reportMissingTypeArgument]
    """Per-department task aggregates computed from real tasks, org-scoped."""

    permission_classes = (IsAuthenticated,)
    serializer_class = DummySerializer

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        from django.db.models import Count, Q

        from apps.production.constants.task import TaskStatus
        from apps.production.models import Task

        org = _resolve_org(request)
        base = Task.objects.filter(organization=org) if org is not None else Task.objects.none()
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
