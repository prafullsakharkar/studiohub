"""
Login History serializer.
"""
from rest_framework import serializers

from apps.audit.models.login_history import LoginHistory


class LoginHistorySerializer(serializers.ModelSerializer):
    """
    Serializer for LoginHistory.
    """
    
    user_email = serializers.CharField(source="user.email", read_only=True)
    user_name = serializers.CharField(source="user.full_name", read_only=True)
    organization_name = serializers.CharField(source="organization.name", read_only=True)
    
    class Meta:
        model = LoginHistory
        fields = (
            "id",
            "uuid",
            "login_type",
            "login_method",
            "status",
            "user",
            "user_email",
            "user_name",
            "organization",
            "organization_name",
            "ip_address",
            "user_agent",
            "location",
            "mfa_enabled",
            "mfa_type",
            "session_id",
            "device_name",
            "device_type",
            "browser",
            "browser_version",
            "operating_system",
            "failure_reason",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "uuid",
            "created_at",
            "updated_at",
        )
