from django.db.models import QuerySet

from apps.production.models import Shot
from apps.production.selectors.base import ProductionBaseSelector


class ShotSelector(ProductionBaseSelector):
    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet:
        return Shot.objects.select_related(
            "organization", "project", "assigned_artist"
        ).all()
