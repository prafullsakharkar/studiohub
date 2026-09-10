"""
Audit Log serializer.
"""
from rest_framework import serializers

from apps.audit.models.audit_log import AuditLog


class AuditLogSerializer(serializers.ModelSerializer[AuditLog]):
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


class AuditLogFrontendSerializer(serializers.ModelSerializer[AuditLog]):
    """
    Frontend-contract shape for the flat ``GET /api/v1/audit/`` alias.

    Maps the backend ``target_*/actor`` columns onto the frontend
    ``AuditLog`` type (``entity_type/entity_id/entity_code/user_*``) so the
    AuditLogsPage renders without a frontend change. Read-only; the alias
    exposes list only (audit stays append-only, no POST).
    """

    organization_id = serializers.UUIDField(read_only=True)
    user_id = serializers.UUIDField(source="actor_id", read_only=True)
    user_name = serializers.SerializerMethodField()
    user_email = serializers.SerializerMethodField()
    entity_type = serializers.CharField(source="target_type", read_only=True)
    entity_id = serializers.CharField(source="target_id", read_only=True)
    entity_code = serializers.CharField(source="target_name", read_only=True)
    changes_diff = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = (
            "id",
            "uuid",
            "organization_id",
            "user_id",
            "user_name",
            "user_email",
            "action",
            "entity_type",
            "entity_id",
            "entity_code",
            "description",
            "ip_address",
            "changes_diff",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_user_name(self, obj) -> str:
        actor = getattr(obj, "actor", None)
        if actor is None:
            return ""
        profile = getattr(actor, "profile", None)
        if profile is None:
            try:
                from apps.identity.models import Profile

                profile = Profile.objects.filter(user=actor).first()
            except Exception:
                profile = None
        return (
            getattr(profile, "display_name", "") or ""
        ) or getattr(actor, "email", "") or ""

    def get_user_email(self, obj) -> str:
        actor = getattr(obj, "actor", None)
        return getattr(actor, "email", "") or ""

    def get_changes_diff(self, obj):
        metadata = getattr(obj, "metadata", None)
        return metadata or None
