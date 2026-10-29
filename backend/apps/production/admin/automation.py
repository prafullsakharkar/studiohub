from django.contrib import admin

from apps.core.admin.base import StudioHubModelAdmin
from apps.production.admin.mixins import NoHardDeleteMixin
from apps.production.models import AutomationAuditLog, AutomationRule


@admin.register(AutomationRule)
class AutomationRuleAdmin(NoHardDeleteMixin, StudioHubModelAdmin):
    list_display = (
        "name",
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
    )

    search_fields = (
        "name",
        "description",
    )

    autocomplete_fields = ("workflow",)

    list_select_related = ("workflow",)

    ordering = ("-updated_at",)


@admin.register(AutomationAuditLog)
class AutomationAuditLogAdmin(NoHardDeleteMixin, StudioHubModelAdmin):
    list_display = (
        "rule_name",
        "trigger_event",
        "entity_code",
        "status",
        "duration_ms",
        "executed_at",
    )

    list_filter = (
        "trigger_event",
        "status",
    )

    search_fields = (
        "rule_name",
        "workflow_name",
        "entity_code",
        "actor_name",
    )

    autocomplete_fields = ("rule", "workflow", "actor")

    list_select_related = ("rule", "workflow", "actor")

    ordering = ("-executed_at",)
