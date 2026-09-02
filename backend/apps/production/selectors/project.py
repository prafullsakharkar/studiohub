from django.db.models import QuerySet

from apps.production.models import Project
from apps.production.selectors.base import ProductionBaseSelector


class ProjectSelector(ProductionBaseSelector):
    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet:
        return Project.objects.select_related(
            "organization", "supervisor", "coordinator"
        ).all()
