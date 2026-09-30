from typing import Any

from rest_framework import serializers


class EpisodeBulkItemSerializer(serializers.Serializer[Any]):
    """Input item for bulk-create. ``project_id`` targets the owning project
    (resolved and scoped to the active organization by the service)."""

    project_id = serializers.UUIDField()
    code = serializers.CharField(max_length=50)
    name = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    season_number = serializers.IntegerField(required=False, allow_null=True)
    episode_number = serializers.IntegerField(required=False, allow_null=True)
    status = serializers.CharField(required=False, allow_blank=True, default="")
    description = serializers.CharField(required=False, allow_blank=True, default="")
    frame_in = serializers.IntegerField(required=False, default=1001)
    frame_out = serializers.IntegerField(required=False, default=1100)
    metadata = serializers.DictField(required=False, default=dict)


class EpisodeBulkCreateSerializer(serializers.Serializer[Any]):
    items = EpisodeBulkItemSerializer(many=True, required=True)


class EpisodeBulkUpdateItemSerializer(serializers.Serializer[Any]):
    """Input item for bulk-update: ``id`` targets an existing episode."""

    id = serializers.UUIDField()
    name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    code = serializers.CharField(max_length=50, required=False)
    season_number = serializers.IntegerField(required=False, allow_null=True)
    episode_number = serializers.IntegerField(required=False, allow_null=True)
    status = serializers.CharField(required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)
    frame_in = serializers.IntegerField(required=False)
    frame_out = serializers.IntegerField(required=False)
    metadata = serializers.DictField(required=False)
