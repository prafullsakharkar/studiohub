"""
API Request serializer.
"""
from rest_framework import serializers

from apps.audit.models.api_request import APIRequest


class APIRequestSerializer(serializers.ModelSerializer):
    """
    Serializer for APIRequest.
    """
    
    user_email = serializers.CharField(source="user.email", read_only=True)
    user_name = serializers.CharField(source="user.full_name", read_only=True)
    organization_name = serializers.CharField(source="organization.name", read_only=True)
    
    class Meta:
        model = APIRequest
        fields = (
            "id",
            "uuid",
            "method",
            "path",
            "full_path",
            "status_code",
            "status_category",
            "response_time_ms",
            "request_size_bytes",
            "response_size_bytes",
            "user",
            "user_email",
            "user_name",
            "organization",
            "organization_name",
            "ip_address",
            "user_agent",
            "api_version",
            "request_headers",
            "request_body",
            "response_headers",
            "response_body",
            "error_message",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "uuid",
            "created_at",
            "updated_at",
        )
