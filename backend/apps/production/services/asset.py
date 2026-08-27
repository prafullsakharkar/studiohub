from apps.core.services.business import BusinessService
from apps.production.models import Asset


class AssetService(BusinessService):
    model = Asset
