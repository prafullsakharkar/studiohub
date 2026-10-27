from uuid import UUID

from django.db.models import CharField, F, QuerySet, Value
from django.db.models.functions import Coalesce

from apps.production.models import Version
from apps.production.selectors.base import ProductionBaseSelector


class VersionSelector(ProductionBaseSelector):
    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[Version]:
        return Version.objects.select_related(
            "project", "shot", "asset", "task", "artist", "artist__profile"
        ).annotate(
            artist_name_annotated=Coalesce(F("artist__profile__display_name"), F("artist__email"), Value(""), output_field=CharField()),
            project_code_annotated=F("project__code"),
            entity_name_annotated=F("entity_name"),
        ).all()

    @classmethod
    def resolve_visible(cls, request, version_id) -> Version | None:
        """
        The live version with this id, if the caller may use its project.

        ``None`` for an unknown, malformed, deleted or out-of-reach id alike.
        """
        try:
            pk = UUID(str(version_id))
        except ValueError:
            return None
        version = Version.objects.select_related("project").filter(pk=pk).first()
        if version is None or not cls.user_has_project_access(
            request=request, project=version.project
        ):
            return None
        return version

    @classmethod
    def resolve_in_project(cls, project_id, version_id) -> Version | None:
        """The live version with this id, if it belongs to that project (no caller check)."""
        try:
            pk = UUID(str(version_id))
        except ValueError:
            return None
        return Version.objects.filter(pk=pk, project_id=project_id).first()

    @classmethod
    def resolve(cls, version_id) -> Version | None:
        """The live version with this id (no caller check; for callers that check the project themselves)."""
        try:
            pk = UUID(str(version_id))
        except ValueError:
            return None
        return Version.objects.select_related("project").filter(pk=pk).first()
