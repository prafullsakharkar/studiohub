from apps.production.api.serializers.asset.update import AssetUpdateSerializer
from apps.production.models import Asset
from apps.production.services.bulk import BulkOperationService


class AssetService(BulkOperationService):
    model = Asset
    bulk_update_serializer = AssetUpdateSerializer
