from django.db.models import QuerySet

from apps.production.models import Shot
from apps.production.selectors.base import ProductionBaseSelector
from apps.production.selectors.rollups import ShotCurrentVersionSelector


class ShotSelector(ProductionBaseSelector):
    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[Shot]:
        return ShotCurrentVersionSelector.annotate(
            Shot.objects.select_related("project", "assigned_artist", "sequence")
        )
