"""
Activity serializer.
"""
from rest_framework import serializers

from apps.audit.models.activity import Activity


class ActivityFrontendSerializer(serializers.ModelSerializer[Activity]):
    """Frontend-contract shape for the activity feed.

    Consumed by ``useOrganizationActivity`` (Access audit sections), which
    reads ``results[]`` items with ``id/timestamp/actor_*/action`` names and
    falls back to ``created_at/user_*/description/metadata``. Covers both,
    so current and future callers work.
    """

    timestamp = serializers.DateTimeField(source="created_at", read_only=True)
    actor_name = serializers.CharField(source="user.full_name", read_only=True)
    actor_email = serializers.CharField(source="user.email", read_only=True)
    action = serializers.CharField(source="activity_type", read_only=True)
    organization_id = serializers.UUIDField(source="organization.id", read_only=True)

    class Meta:
        model = Activity
        fields = (
            "id",
            "timestamp",
            "actor_name",
            "actor_email",
            "action",
            "description",
            "organization_id",
            "metadata",
            "created_at",
        )
        read_only_fields = fields


class ActivitySerializer(serializers.ModelSerializer[Activity]):
    """
    Serializer for Activity.
    """

    user_email = serializers.CharField(source="user.email", read_only=True)
    user_name = serializers.CharField(source="user.full_name", read_only=True)
    organization_name = serializers.CharField(source="organization.name", read_only=True)
    
    class Meta:
        model = Activity
        fields = (
            "id",
            "uuid",
            "activity_type",
            "status",
            "description",
            "user",
            "user_email",
            "user_name",
            "organization",
            "organization_name",
            "ip_address",
            "user_agent",
            "duration_seconds",
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
