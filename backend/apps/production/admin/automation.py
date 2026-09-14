from django.contrib import admin

from apps.organization.admin.base import OrganizationScopedModelAdmin
from apps.production.models import AutomationAuditLog, AutomationRule


@admin.register(AutomationRule)
class AutomationRuleAdmin(OrganizationScopedModelAdmin):
    list_display = (
        "name",
        "organization",
        "trigger_event",
        "trigger_entity_type",
        "is_active",
        "execution_count",
        "last_status",
    )

    list_filter = (
        "trigger_event",
        "trigger_entity_type",
        "is_active",
        "last_status",
        "organization",
    )

    search_fields = (
        "name",
        "description",
    )

    autocomplete_fields = ("workflow", "organization")

    list_select_related = ("workflow", "organization")

    ordering = ("-updated_at",)


@admin.register(AutomationAuditLog)
class AutomationAuditLogAdmin(OrganizationScopedModelAdmin):
    list_display = (
        "rule_name",
        "organization",
        "trigger_event",
        "entity_code",
        "status",
        "duration_ms",
        "executed_at",
    )

    list_filter = (
        "trigger_event",
        "status",
        "organization",
    )

    search_fields = (
        "rule_name",
        "workflow_name",
        "entity_code",
        "actor_name",
    )

    autocomplete_fields = ("rule", "workflow", "actor", "organization")

    list_select_related = ("rule", "workflow", "actor", "organization")

    ordering = ("-executed_at",)
