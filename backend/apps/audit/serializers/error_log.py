"""
Error Log serializer.
"""
from rest_framework import serializers

from apps.audit.models.error_log import ErrorLog


class ErrorLogSerializer(serializers.ModelSerializer):
    """
    Serializer for ErrorLog.
    """
    
    user_email = serializers.CharField(source="user.email", read_only=True)
    user_name = serializers.CharField(source="user.full_name", read_only=True)
    organization_name = serializers.CharField(source="organization.name", read_only=True)
    resolved_by_email = serializers.CharField(source="resolved_by.email", read_only=True)
    resolved_by_name = serializers.CharField(source="resolved_by.full_name", read_only=True)
    
    class Meta:
        model = ErrorLog
        fields = (
            "id",
            "uuid",
            "severity",
            "error_type",
            "error_code",
            "message",
            "stack_trace",
            "user",
            "user_email",
            "user_name",
            "organization",
            "organization_name",
            "ip_address",
            "user_agent",
            "request_path",
            "request_method",
            "context_data",
            "resolved",
            "resolved_at",
            "resolved_by",
            "resolved_by_email",
            "resolved_by_name",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "uuid",
            "created_at",
            "updated_at",
        )
