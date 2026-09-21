from django.db.models import QuerySet

from apps.production.models import Show
from apps.production.selectors.base import ProductionBaseSelector


class ShowSelector(ProductionBaseSelector):
    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[Show]:
        return Show.objects.select_related("organization", "project").order_by(
            "project", "-is_primary", "code"
        )
