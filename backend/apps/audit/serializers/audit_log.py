"""
Audit Log serializer.
"""
from rest_framework import serializers

from apps.audit.models.audit_log import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    """
    Serializer for AuditLog.
    """
    
    actor_email = serializers.CharField(source="actor.email", read_only=True)
    actor_name = serializers.CharField(source="actor.full_name", read_only=True)
    organization_name = serializers.CharField(source="organization.name", read_only=True)
    
    class Meta:
        model = AuditLog
        fields = (
            "id",
            "uuid",
            "action",
            "severity",
            "target_type",
            "target_id",
            "target_name",
            "description",
            "actor",
            "actor_email",
            "actor_name",
            "organization",
            "organization_name",
            "ip_address",
            "user_agent",
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
