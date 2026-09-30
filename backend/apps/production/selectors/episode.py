from django.db.models import QuerySet

from apps.production.models import Episode
from apps.production.selectors.base import ProductionBaseSelector


class EpisodeSelector(ProductionBaseSelector):
    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[Episode]:
        return Episode.objects.select_related("organization", "project").all()
