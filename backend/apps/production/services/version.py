from apps.core.services.business import BusinessService
from apps.production.models import Version


class VersionService(BusinessService):
    model = Version
