from typing import Any

from rest_framework import serializers

from apps.core.api.serializers.base import BaseReadSerializer
from apps.production.api.serializers.actions import ShareSettingsSerializer
from apps.production.models import Playlist


def entry_dict(row: Any) -> dict[str, Any]:
    """An entry as the frontend reads it: the client's own keys, then the ones the server owns."""
    data = dict(row.extra or {})
    version = row.version
    data.update(
        {
            "id": str(row.pk),
            "legacy_id": row.legacy_id,
            "version_id": str(version.pk) if version else None,
            "item_order": row.position,
        }
    )
    if version is not None:
        data["version_number"] = version.version_number
    return data


def entries_data(playlist: Any) -> list[dict[str, Any]]:
    return [entry_dict(row) for row in playlist.entry_rows.all()]


class ShareSettingsField(serializers.JSONField):
    """``share_settings``: the known keys are typed, any other key passes through (as the share action)."""

    def to_internal_value(self, data):
        value = super().to_internal_value(data)
        if not isinstance(value, dict):
            raise serializers.ValidationError("Expected an object.")
        inner = ShareSettingsSerializer(data=value)
        inner.is_valid(raise_exception=True)
        return dict(inner.validated_data)


class PlaylistSerializer(BaseReadSerializer[Any]):
    is_archived = serializers.BooleanField(source="is_deleted", read_only=True)
    project_id = serializers.UUIDField(read_only=True, allow_null=True)
    entries = serializers.SerializerMethodField()

    class Meta:
        model = Playlist
        fields = ("id","uuid","project_id","name","code","description","status","client_only","entries","share_settings","activity","is_archived","created_at","updated_at")
        read_only_fields = ("id","uuid","created_at","updated_at")

    def get_entries(self, obj):
        return entries_data(obj)
