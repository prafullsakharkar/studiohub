from django.db.models import QuerySet

from apps.production.models import Project
from apps.production.selectors.base import ProductionBaseSelector


class ProjectSelector(ProductionBaseSelector):
    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[Project]:
        return Project.objects.select_related(
            "organization", "supervisor", "coordinator"
        ).all()

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
