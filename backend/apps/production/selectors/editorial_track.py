from django.db.models import QuerySet

from apps.production.models import EditorialTrack
from apps.production.selectors.base import ProductionBaseSelector


class EditorialTrackSelector(ProductionBaseSelector):
    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[EditorialTrack]:
        return EditorialTrack.objects.select_related(
            "organization", "project"
        ).order_by("project", "track_number")
