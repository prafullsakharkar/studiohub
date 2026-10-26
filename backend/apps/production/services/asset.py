from apps.production.models import Asset
from apps.production.services.bulk import BulkOperationService


class AssetService(BulkOperationService):
    model = Asset
