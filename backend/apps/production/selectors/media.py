from django.db.models import QuerySet

from apps.production.models import Media
from apps.production.selectors.base import ProductionBaseSelector


class MediaSelector(ProductionBaseSelector):
    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet:
        return Media.objects.select_related(
            "organization", "project"
        ).all()
