from apps.production.api.serializers.shot.update import ShotUpdateSerializer
from apps.production.models import Shot
from apps.production.services.bulk import BulkOperationService


class ShotService(BulkOperationService):
    model = Shot
    bulk_update_serializer = ShotUpdateSerializer
