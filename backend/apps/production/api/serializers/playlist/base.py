from rest_framework import serializers

from apps.core.api.serializers.base import BaseReadSerializer
from apps.production.models import Playlist


class PlaylistSerializer(BaseReadSerializer):
    project_id = serializers.UUIDField(read_only=True, allow_null=True)
    class Meta:
        model = Playlist
        fields = ("id","uuid","project_id","name","code","description","status","client_only","entries","share_settings","activity","is_archived","created_at","updated_at")
        read_only_fields = ("id","uuid","created_at","updated_at")
