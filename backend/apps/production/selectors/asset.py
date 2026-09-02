from django.db.models import QuerySet

from apps.production.models import Asset
from apps.production.selectors.base import ProductionBaseSelector


class AssetSelector(ProductionBaseSelector):
    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet:
        return Asset.objects.select_related(
            "organization", "project", "department", "team", "assigned_artist"
        ).all()
