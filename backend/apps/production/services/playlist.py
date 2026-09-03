from apps.core.services.business import BusinessService
from apps.production.models import Playlist


class PlaylistService(BusinessService):
    model = Playlist
