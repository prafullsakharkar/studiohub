from typing import Any

from rest_framework import serializers

from apps.core.api.serializers.base import BaseWriteSerializer
from apps.production.api.serializers.common import LockedFieldsMixin
from apps.production.models import Playlist


class PlaylistUpdateSerializer(LockedFieldsMixin, BaseWriteSerializer[Any]):
    locked_fields = {
        "is_archived": "Use the archive and restore actions.",
    }

    is_archived = serializers.BooleanField(source="is_deleted", read_only=True)

    class Meta:
        model = Playlist
        fields = ("name","code","description","status","client_only","entries","share_settings","is_archived")
