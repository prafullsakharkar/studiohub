from django.db.models import QuerySet

from apps.production.models import Workflow
from apps.production.selectors.base import ProductionBaseSelector


class WorkflowSelector(ProductionBaseSelector):
    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet:
        return Workflow.objects.select_related(
            "organization", "project"
        ).all()
