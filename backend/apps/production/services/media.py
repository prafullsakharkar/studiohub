from apps.core.services.business import BusinessService
from apps.production.models import Media


class MediaService(BusinessService):
    model = Media
