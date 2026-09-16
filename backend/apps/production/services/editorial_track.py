from apps.core.services.business import BusinessService
from apps.production.models import EditorialTrack


class EditorialTrackService(BusinessService):
    model = EditorialTrack
