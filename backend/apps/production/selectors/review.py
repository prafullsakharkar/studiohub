from django.db.models import QuerySet

from apps.production.models import Review
from apps.production.selectors.base import ProductionBaseSelector


class ReviewSelector(ProductionBaseSelector):
    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet:
        return Review.objects.select_related(
            "organization", "project", "lead_reviewer"
        ).all()
