from django.db.models import CharField, QuerySet, F, Value
from django.db.models.functions import Coalesce, Concat

from apps.production.models import Task


class TaskSelector:
    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet:
        qs = (
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
        if request is not None:
            org_id = request.headers.get("X-Organization-Id") or request.headers.get("X-Organization") or getattr(request, "organization", None)
            if org_id:
                try:
                    org_pk = org_id.id if hasattr(org_id, "id") else org_id
                    qs = qs.filter(organization_id=org_pk)
                except Exception:
                    pass
        return qs
