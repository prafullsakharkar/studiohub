from django.db.models import QuerySet

from apps.production.models import Sequence
from apps.production.selectors.base import ProductionBaseSelector


class SequenceSelector(ProductionBaseSelector):
    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet:
        return Sequence.objects.select_related("organization", "project").all()
