from __future__ import annotations

from typing import Any

from django.db.models import QuerySet

from apps.production.models import Project
from apps.production.selectors.base import ProductionBaseSelector


class ProjectSelector(ProductionBaseSelector):
    # Frontend-contract compat: studiohub-react mock dataset project ids
    # (`src/mocks/db/production/projects.ts`) are stable strings (`proj-001` …)
    # while the backend PK is a UUID. List hooks send the store's active
    # project id verbatim (`?project_id=proj-001`), so filters must resolve
    # mock ids to their canonical codes instead of 400ing. Mirrors
    # `OrganizationSelector.FRONTEND_MOCK_ID_TO_CODE`.
    FRONTEND_MOCK_ID_TO_CODE: dict[str, str] = {
        "proj-001": "NK99",
        "proj-002": "AETH2",
        "proj-003": "VEL01",
        "proj-004": "LUM01",
        "proj-101": "NEB01",
        "proj-102": "SOL03",
        "proj-201": "PAN02",
        "proj-301": "DMQ01",
    }

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[Project]:
        return Project.objects.select_related(
            "organization", "supervisor", "coordinator"
        ).all()

    @classmethod
    def resolve_by_lookup(cls, organization, lookup: Any) -> Project | None:
        """
        Resolve a project within ``organization`` from a list-filter value.

        Accepts UUID pk, ``code`` (case-insensitive), or frontend mock-dataset
        id (``proj-001`` …). Returns ``None`` when unresolvable; callers turn
        that into an empty result (matching mock exact-match semantics), never
        a 400. Soft-deleted projects never resolve.
        """
        if lookup is None:
            return None
        if isinstance(lookup, Project):
            return lookup if not lookup.is_deleted else None
        text = str(lookup).strip()
        if not text:
            return None
        # No org context (e.g. header-less staff call): resolve globally so
        # previously working UUID lookups keep working. With an org, scope to
        # it so mock ids/codes can never cross the tenant boundary.
        base = cls.get_queryset().filter(is_deleted=False)
        if organization is not None:
            base = base.filter(organization=organization)
        hit: Any = None
        try:
            hit = base.filter(id=text).first()
        except (ValueError, TypeError, Exception):
            hit = None
        if hit is not None:
            return hit
        hit = base.filter(code__iexact=text).first()
        if hit is not None:
            return hit
        code = cls.FRONTEND_MOCK_ID_TO_CODE.get(text.lower())
        if code:
            hit = base.filter(code__iexact=code).first()
            if hit is not None:
                return hit
        return None

    @classmethod
    def summary_counts(cls, project) -> dict:
        """Aggregate entity counts for a project (summary/statistics contract)."""
        from apps.deliveries.models import DeliveryPackage
        from apps.production.models import (
            Asset,
            EditorialCut,
            ProjectNote,
            Review,
            Sequence,
            Shot,
            Task,
            Version,
        )

        organization = project.organization
        sequences = Sequence.objects.filter(organization=organization, project=project).count()
        shots_qs = Shot.objects.filter(organization=organization, project=project)
        shots = shots_qs.count()
        tasks_qs = Task.objects.filter(organization=organization, project=project)
        tasks = tasks_qs.count()
        assets = Asset.objects.filter(organization=organization, project=project).count()
        versions = Version.objects.filter(organization=organization, project=project).count()
        reviews = Review.objects.filter(organization=organization, project=project).count()
        deliveries = DeliveryPackage.objects.filter(
            organization=organization, project=project
        ).count()
        notes = ProjectNote.objects.filter(organization=organization, project=project).count()
        return {
            "sequences": sequences,
            "shots": shots,
            "tasks": tasks,
            "assets": assets,
            "versions": versions,
            "reviews": reviews,
            "deliveries": deliveries,
            "notes": notes,
            "editorial": EditorialCut.objects.filter(
                organization=organization, project=project
            ).count(),
            "approved_shots": shots_qs.filter(status="Approved").count(),
            "in_progress_shots": shots_qs.filter(status="In Progress").count(),
            "completed_tasks": tasks_qs.filter(status__in=["Approved", "Completed"]).count(),
        }
