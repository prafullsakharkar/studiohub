from rest_framework import serializers
from apps.core.api.serializers.base import BaseWriteSerializer
from apps.production.models import Playlist
class PlaylistCreateSerializer(BaseWriteSerializer):
    id = serializers.UUIDField(read_only=True)
    uuid = serializers.UUIDField(read_only=True)
    class Meta:
        model = Playlist
        fields = ("id","uuid","project","name","code","description","status","client_only","entries","share_settings")
        read_only_fields = ("id","uuid")
