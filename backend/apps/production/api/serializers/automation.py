"""
Automation serializers (frontend `AutomationRule` / `AutomationAuditLog` contract).
"""

from __future__ import annotations

from typing import Any

from rest_framework import serializers

from apps.production.models import AutomationAuditLog, AutomationRule


class AutomationRuleSerializer(serializers.ModelSerializer[AutomationRule]):
    id = serializers.UUIDField(read_only=True)
    workflow_id = serializers.SerializerMethodField()
    trigger = serializers.JSONField(required=False)

    class Meta:
        model = AutomationRule
        fields = (
            "id",
            "workflow_id",
            "name",
            "description",
            "trigger",
            "conditions",
            "actions",
            "is_active",
            "required_role",
            "execution_count",
            "last_triggered_at",
            "last_status",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "workflow_id",
            "execution_count",
            "last_triggered_at",
            "last_status",
            "created_at",
            "updated_at",
        )

    def get_workflow_id(self, obj: AutomationRule) -> str | None:
        return str(obj.workflow_id) if obj.workflow_id else None

    def to_representation(self, instance: AutomationRule) -> dict[str, Any]:
        data = super().to_representation(instance)
        data["trigger"] = {
            "event": instance.trigger_event,
            "entity_type": instance.trigger_entity_type,
            "filters": instance.trigger_filters or {},
        }
        return data

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        trigger = attrs.pop("trigger", None)
        if trigger is not None:
            if not isinstance(trigger, dict):
                raise serializers.ValidationError({"trigger": "Must be an object."})
            attrs["trigger_event"] = trigger.get("event", "") or ""
            attrs["trigger_entity_type"] = trigger.get("entity_type", "") or ""
            attrs["trigger_filters"] = trigger.get("filters") or {}
        return attrs


class AutomationAuditLogSerializer(serializers.ModelSerializer[AutomationAuditLog]):
    id = serializers.UUIDField(read_only=True)
    rule_id = serializers.SerializerMethodField()
    workflow_id = serializers.SerializerMethodField()
    actor_id = serializers.SerializerMethodField()

    class Meta:
        model = AutomationAuditLog
        fields = (
            "id",
            "rule_id",
            "rule_name",
            "workflow_id",
            "workflow_name",
            "trigger_event",
            "entity_type",
            "entity_id",
            "entity_code",
            "actor_id",
            "actor_name",
            "actor_role",
            "executed_at",
            "duration_ms",
            "status",
            "step_logs",
            "action_logs",
        )
        read_only_fields = fields

    def get_rule_id(self, obj: AutomationAuditLog) -> str | None:
        return str(obj.rule_id) if obj.rule_id else None

    def get_workflow_id(self, obj: AutomationAuditLog) -> str | None:
        return str(obj.workflow_id) if obj.workflow_id else None

    def get_actor_id(self, obj: AutomationAuditLog) -> str | None:
        return str(obj.actor_id) if obj.actor_id else None
