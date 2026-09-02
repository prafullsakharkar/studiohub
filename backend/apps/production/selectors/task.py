from django.db.models import CharField, F, QuerySet, Value
from django.db.models.functions import Coalesce

from apps.production.models import Task
from apps.production.selectors.base import ProductionBaseSelector


class TaskSelector(ProductionBaseSelector):
    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet:
        return (
            Task.objects.select_related("organization", "project", "team", "assignee", "reviewer", "assignee__profile", "reviewer__profile")
            .prefetch_related("project__organization")
            .annotate(
                assignee_name_annotated=Coalesce(F("assignee__profile__display_name"), F("assignee__email"), Value(""), output_field=CharField()),
                reviewer_name_annotated=Coalesce(F("reviewer__profile__display_name"), F("reviewer__email"), Value(""), output_field=CharField()),
                project_code_annotated=F("project__code"),
                team_name_annotated=F("team__name"),
            )
            .all()
        )
