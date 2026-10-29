from typing import Any

from rest_framework import serializers

from apps.core.api.serializers.base import BaseWriteSerializer
from apps.production.api.serializers.common import ProjectReferenceMixin
from apps.production.api.serializers.playlist.base import ShareSettingsField, entries_data
from apps.production.models import Playlist


class PlaylistCreateSerializer(ProjectReferenceMixin, BaseWriteSerializer[Any]):
    id = serializers.UUIDField(read_only=True)
    uuid = serializers.UUIDField(read_only=True)
    #: entries sent with a new playlist become rows (each version must be of the project);
    #: the response shows the rows
    entries = serializers.ListField(child=serializers.DictField(), required=False)
    share_settings = ShareSettingsField(required=False)

    class Meta:
        model = Playlist
        fields = ("id","uuid","project","project_id","project_code","name","code","description","status","client_only","entries","share_settings")
        read_only_fields = ("id","uuid")
        extra_kwargs = {"project": {"required": False}}

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["entries"] = entries_data(instance)
        return data
