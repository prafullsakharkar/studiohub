"""
Automation models.
"""

from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.core.models.bases import EntityModel


class AutomationRule(EntityModel):
    """
    Event-driven automation rule owned by an organization.

    Backs ``/api/v1/automations/rules/`` CRUD, replacing the former echo stub
    (hardcoded ``rule-001`` id). The frontend trigger object
    (``{event, entity_type, filters}``) is stored decomposed into
    ``trigger_event`` / ``trigger_entity_type`` / ``trigger_filters``; the
    serializer recomposes it. Execution counters (``execution_count``,
    ``last_triggered_at``, ``last_status``) are server-maintained and read-only
    on the API.
    """

    organization = models.ForeignKey(
        "organization.Organization",
        on_delete=models.CASCADE,
        related_name="automation_rules",
        db_index=True,
    )
    workflow = models.ForeignKey(
        "production.Workflow",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        # NOTE: ``Workflow.automation_rules`` (JSONField) already owns that
        # name, so the reverse accessor uses ``automation_rule_links``.
        related_name="automation_rule_links",
        db_index=True,
    )

    name = models.CharField(max_length=255, db_index=True)
    description = models.TextField(blank=True, default="")

    trigger_event = models.CharField(max_length=100, blank=True, default="", db_index=True)
    trigger_entity_type = models.CharField(max_length=50, blank=True, default="")
    trigger_filters = models.JSONField(default=dict, blank=True)

    conditions = models.JSONField(default=list, blank=True)
    actions = models.JSONField(default=list, blank=True)

    is_active = models.BooleanField(default=True, db_index=True)
    required_role = models.CharField(max_length=100, blank=True, default="")

    execution_count = models.PositiveIntegerField(default=0)
    last_triggered_at = models.DateTimeField(null=True, blank=True)
    last_status = models.CharField(max_length=20, blank=True, default="")

    class Meta:
        db_table = "production_automation_rule"
        ordering = ("-updated_at",)
        indexes = [
            models.Index(fields=["organization", "workflow"]),
            models.Index(fields=["organization", "is_active"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.trigger_event})"


class AutomationAuditLog(EntityModel):
    """
    Append-only record of a single automation rule execution.

    Backs ``GET /api/v1/automations/audit-logs/``. Written by the automation
    engine via ``apps.production.services.automation.log_execution``; there is
    no write endpoint (audit is append-only). Rule/workflow/actor references
    are nullable with denormalized name fields so log rows survive deletion of
    the referenced records.
    """

    organization = models.ForeignKey(
        "organization.Organization",
        on_delete=models.CASCADE,
        related_name="automation_audit_logs",
        db_index=True,
    )
    rule = models.ForeignKey(
        "production.AutomationRule",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
        db_index=True,
    )
    rule_name = models.CharField(max_length=255, blank=True, default="")
    workflow = models.ForeignKey(
        "production.Workflow",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="automation_audit_log_links",
        db_index=True,
    )
    workflow_name = models.CharField(max_length=255, blank=True, default="")

    trigger_event = models.CharField(max_length=100, blank=True, default="")
    entity_type = models.CharField(max_length=50, blank=True, default="")
    entity_id = models.CharField(max_length=100, blank=True, default="")
    entity_code = models.CharField(max_length=100, blank=True, default="")

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="automation_audit_logs",
        db_index=True,
    )
    actor_name = models.CharField(max_length=255, blank=True, default="")
    actor_role = models.CharField(max_length=100, blank=True, default="")

    executed_at = models.DateTimeField(db_index=True)
    duration_ms = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=20, default="success", db_index=True)
    step_logs = models.JSONField(default=list, blank=True)
    action_logs = models.JSONField(default=list, blank=True)

    class Meta:
        db_table = "production_automation_audit_log"
        ordering = ("-executed_at",)
        indexes = [
            models.Index(fields=["organization", "rule"]),
            models.Index(fields=["organization", "status"]),
        ]

    def __str__(self):
        return f"{self.rule_name} → {self.status} ({self.executed_at})"
