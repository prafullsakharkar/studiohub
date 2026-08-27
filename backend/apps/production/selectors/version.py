from django.db.models import CharField, QuerySet, F, Value
from django.db.models.functions import Coalesce
from apps.production.models import Version
class VersionSelector:
    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet:
        qs = Version.objects.select_related("organization", "project", "shot", "asset", "task", "artist", "artist__profile").annotate(
                artist_name_annotated=Coalesce(F("artist__profile__display_name"), F("artist__email"), Value(""), output_field=CharField()),
                project_code_annotated=F("project__code"),
                entity_name_annotated=F("entity_name"),
            ).all()
        if request is not None:
            org_id = request.headers.get("X-Organization-Id") or request.headers.get("X-Organization") or getattr(request, "organization", None)
            if org_id:
                try:
                    org_pk = org_id.id if hasattr(org_id, "id") else org_id
                    qs = qs.filter(organization_id=org_pk)
                except Exception:
                    pass
        return qs
