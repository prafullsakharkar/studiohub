from django.db.models import QuerySet

from apps.production.models import EditorialCut, ProjectMembership
from apps.production.selectors.base import ProductionBaseSelector


class ProjectMembershipSelector(ProductionBaseSelector):
    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[ProjectMembership]:
        return ProjectMembership.objects.select_related(
            "project", "user"
        ).all()


class EditorialCutSelector(ProductionBaseSelector):
    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[EditorialCut]:
        return EditorialCut.objects.select_related("project").all()

