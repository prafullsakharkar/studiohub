from apps.production.models import Asset
from apps.production.services.bulk import BulkOperationService
from apps.production.validators.hierarchy import ensure_no_live_children


class AssetService(BulkOperationService):
    model = Asset

    @classmethod
    def before_delete(cls, instance, **kwargs):
        ensure_no_live_children(instance)
        return instance
