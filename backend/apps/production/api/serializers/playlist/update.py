from apps.core.api.serializers.base import BaseWriteSerializer
from apps.production.models import Playlist


class PlaylistUpdateSerializer(BaseWriteSerializer):
    class Meta:
        model = Playlist
        fields = ("name","code","description","status","client_only","entries","share_settings","is_archived")
