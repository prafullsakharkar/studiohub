from django.db.models import QuerySet

from apps.production.models import StatusHistory
from apps.production.selectors.base import ProductionBaseSelector


class StatusHistorySelector(ProductionBaseSelector):
    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[StatusHistory]:
        return cls.scope_by_project_membership(
            StatusHistory.objects.select_related("actor"), request=request
        )

    @classmethod
    def for_entity(cls, entity, *, request=None) -> QuerySet[StatusHistory]:
        return cls.get_queryset(request=request).filter(
            entity_type=type(entity).__name__, entity_id=entity.pk
        )
