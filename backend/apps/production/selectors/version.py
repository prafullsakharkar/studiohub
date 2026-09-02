from django.db.models import CharField, F, QuerySet, Value
from django.db.models.functions import Coalesce

from apps.production.models import Version
from apps.production.selectors.base import ProductionBaseSelector


class VersionSelector(ProductionBaseSelector):
    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet:
        return Version.objects.select_related(
            "organization", "project", "shot", "asset", "task", "artist", "artist__profile"
        ).annotate(
            artist_name_annotated=Coalesce(F("artist__profile__display_name"), F("artist__email"), Value(""), output_field=CharField()),
            project_code_annotated=F("project__code"),
            entity_name_annotated=F("entity_name"),
        ).all()
