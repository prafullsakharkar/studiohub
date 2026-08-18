"""
Activity serializer.
"""
from rest_framework import serializers

from apps.audit.models.activity import Activity


class ActivitySerializer(serializers.ModelSerializer):
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
