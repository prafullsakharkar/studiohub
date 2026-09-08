from django.db.models import QuerySet

from apps.production.models import EditorialCut, ProjectMembership, ProjectNote
from apps.production.selectors.base import ProductionBaseSelector


class ProjectMembershipSelector(ProductionBaseSelector):
    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[ProjectMembership]:
        return ProjectMembership.objects.select_related(
            "organization", "project", "user"
        ).all()


class EditorialCutSelector(ProductionBaseSelector):
    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[EditorialCut]:
        return EditorialCut.objects.select_related("organization", "project").all()


class ProjectNoteSelector(ProductionBaseSelector):
    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[ProjectNote]:
        return ProjectNote.objects.select_related(
            "organization", "project", "author"
        ).all()
