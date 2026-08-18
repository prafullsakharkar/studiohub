"""
Change Log serializer.
"""
from rest_framework import serializers

from apps.audit.models.change_log import ChangeLog


class ChangeLogSerializer(serializers.ModelSerializer):
    """
    Serializer for ChangeLog.
    """
    
    user_email = serializers.CharField(source="user.email", read_only=True)
    user_name = serializers.CharField(source="user.full_name", read_only=True)
    organization_name = serializers.CharField(source="organization.name", read_only=True)
    
    class Meta:
        model = ChangeLog
        fields = (
            "id",
            "uuid",
            "change_type",
            "target_type",
            "target_id",
            "target_name",
            "user",
            "user_email",
            "user_name",
            "organization",
            "organization_name",
            "before_values",
            "after_values",
            "changed_fields",
            "description",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "uuid",
            "created_at",
            "updated_at",
        )
