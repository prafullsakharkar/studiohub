"""
Track serializer.
"""
from typing import Any

from rest_framework import serializers

from apps.audit.models.track import Track


class TrackSerializer(serializers.ModelSerializer[Track]):
    """
    Serializer for Track.
    """
    
    user_email = serializers.CharField(source="user.email", read_only=True)
    user_name = serializers.CharField(source="user.full_name", read_only=True)
    organization_name = serializers.CharField(source="organization.name", read_only=True)
    
    class Meta:
        model = Track
        fields = (
            "id",
            "uuid",
            "event_type",
            "event_name",
            "user",
            "user_email",
            "user_name",
            "organization",
            "organization_name",
            "session_id",
            "page_url",
            "page_title",
            "element_id",
            "element_text",
            "metadata",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "uuid",
            "created_at",
            "updated_at",
        )


class TrackIngestSerializer(serializers.Serializer[Any]):
    """
    Client telemetry ingestion (player/UI events).

    Accepts the frontend contract including its mock-flavored aliases
    (``track_name`` -> ``event_name``, ``duration_ms`` folded into
    ``metadata``). ``user``/``organization`` are never accepted from the
    client — the viewset resolves them server-side.
    """

    event_type = serializers.ChoiceField(
        choices=[c[0] for c in Track.EVENT_CHOICES], required=True
    )
    event_name = serializers.CharField(
        required=False, allow_blank=True, max_length=255, default=""
    )
    track_name = serializers.CharField(
        required=False, allow_blank=True, max_length=255, default=""
    )
    session_id = serializers.CharField(
        required=False, allow_blank=True, max_length=100, default=""
    )
    page_url = serializers.CharField(
        required=False, allow_blank=True, max_length=500, default=""
    )
    page_title = serializers.CharField(
        required=False, allow_blank=True, max_length=255, default=""
    )
    element_id = serializers.CharField(
        required=False, allow_blank=True, max_length=255, default=""
    )
    element_text = serializers.CharField(
        required=False, allow_blank=True, max_length=255, default=""
    )
    duration_ms = serializers.IntegerField(required=False, allow_null=True)
    metadata = serializers.DictField(required=False, default=dict)
