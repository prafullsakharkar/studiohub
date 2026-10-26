from typing import Any

from rest_framework import serializers

from apps.core.api.serializers.base import BaseWriteSerializer
from apps.production.api.serializers.common import LockedFieldsMixin
from apps.production.api.serializers.playlist.base import ShareSettingsField, entries_data
from apps.production.models import Playlist


class PlaylistUpdateSerializer(LockedFieldsMixin, BaseWriteSerializer[Any]):
    locked_fields = {
        "is_archived": "Use the archive and restore actions.",
        "entries": "Use add-entry, remove-entry and reorder.",
    }

    is_archived = serializers.BooleanField(source="is_deleted", read_only=True)
    entries = serializers.SerializerMethodField()
    share_settings = ShareSettingsField(required=False)

    class Meta:
        model = Playlist
        fields = ("name","code","description","status","client_only","entries","share_settings","is_archived")

    def get_entries(self, obj):
        return entries_data(obj)

    def current_value(self, name):
        if name == "entries":
            return entries_data(self.instance)
        return super().current_value(name)
