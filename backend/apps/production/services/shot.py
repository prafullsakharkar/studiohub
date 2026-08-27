from apps.core.services.business import BusinessService
from apps.production.models import Shot


class ShotService(BusinessService):
    model = Shot
