from apps.production.models import Shot
from apps.production.services.bulk import BulkOperationService


class ShotService(BulkOperationService):
    model = Shot
