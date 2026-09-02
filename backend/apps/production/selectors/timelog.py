from django.db.models import CharField, F, QuerySet, Value
from django.db.models.functions import Coalesce

from apps.production.models import Timelog
from apps.production.selectors.base import ProductionBaseSelector


class TimelogSelector(ProductionBaseSelector):
    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet:
        return (
            Timelog.objects.select_related(
                "organization", "project", "task", "person", "person__profile", "approved_by", "task__project"
            )
            .annotate(
                person_name_annotated=Coalesce(F("person__profile__display_name"), F("person__email"), Value(""), output_field=CharField()),
                task_title_annotated=F("task__title"),
                project_code_annotated=F("project__code"),
            )
            .order_by("-date", "-created_at")
        )
