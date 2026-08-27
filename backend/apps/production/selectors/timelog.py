from django.db.models import CharField, QuerySet, F, Value
from django.db.models.functions import Coalesce

from apps.production.models import Timelog


class TimelogSelector:
    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet:
        qs = (
            Timelog.objects.select_related(
                "organization", "project", "task", "person", "person__profile", "approved_by", "task__project"
            )
            .annotate(
                person_name_annotated=Coalesce(F("person__profile__display_name"), F("person__email"), Value(""), output_field=CharField()),
                task_title_annotated=F("task__title"),
                project_code_annotated=F("project__code"),
            )
            .all()
        )
        if request is not None:
            org_id = request.headers.get("X-Organization-Id") or request.headers.get("X-Organization") or getattr(request, "organization", None)
            if org_id:
                try:
                    org_pk = org_id.id if hasattr(org_id, "id") else org_id
                    qs = qs.filter(organization_id=org_pk)
                except Exception:
                    pass
        return qs.order_by("-date", "-created_at")
