"""
Track serializer.
"""
from rest_framework import serializers

from apps.audit.models.track import Track


class TrackSerializer(serializers.ModelSerializer):
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
