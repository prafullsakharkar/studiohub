"""
Automation services for business logic.
"""

from __future__ import annotations

from typing import Any

from django.utils import timezone

# Distinguishes "leave the workflow link alone" from "unlink it" (``None``).
_UNSET: Any = object()


def create_rule(
    *,
    user,
    data: dict[str, Any],
    project=None,
    workflow=None,
):
    """
    Create an automation rule.

    ``project`` and ``workflow`` are already resolved and authorized by the
    caller (``AutomationRuleSelector``). A rule created for a workflow takes
    the workflow's project unless one is given.
    """
    from apps.production.models import AutomationRule

    resolved_project = project
    if resolved_project is None and workflow is not None:
        resolved_project = workflow.project
    return AutomationRule.objects.create(
        project=resolved_project,
        workflow=workflow,
        name=data.get("name", ""),
        description=data.get("description", ""),
        trigger_event=data.get("trigger_event", ""),
        trigger_entity_type=data.get("trigger_entity_type", ""),
        trigger_filters=data.get("trigger_filters") or {},
        conditions=data.get("conditions") or [],
        actions=data.get("actions") or [],
        is_active=data.get("is_active", True),
        required_role=data.get("required_role", ""),
        created_by=user if getattr(user, "is_authenticated", False) else None,
    )


def update_rule(
    *,
    rule,
    data: dict[str, Any],
    user=None,
    workflow=_UNSET,
):
    """
    Update an automation rule (partial or full).

    ``workflow`` is the resolved workflow to link (``None`` unlinks); leave it
    out to keep the current link.
    """
    updatable = (
        "name",
        "description",
        "trigger_event",
        "trigger_entity_type",
        "trigger_filters",
        "conditions",
        "actions",
        "is_active",
        "required_role",
    )
    for field in updatable:
        if field in data:
            setattr(rule, field, data[field])
    if workflow is not _UNSET:
        rule.workflow = workflow
    if getattr(user, "is_authenticated", False):
        rule.updated_by = user
    rule.save()
    return rule


def delete_rule(
    *,
    rule,
    user=None,
) -> None:
    """Soft-delete an automation rule."""
    rule.soft_delete(user=user)


def log_execution(
    *,
    rule=None,
    trigger_event: str = "",
    entity_type: str = "",
    entity_id: str = "",
    entity_code: str = "",
    actor=None,
    actor_name: str = "",
    actor_role: str = "",
    duration_ms: int = 0,
    status: str = "success",
    step_logs: list | None = None,
    action_logs: list | None = None,
):
    """Append an automation audit-log row (engine hook; no write endpoint)."""
    from apps.production.models import AutomationAuditLog

    workflow = getattr(rule, "workflow", None)
    project = getattr(rule, "project", None)
    if project is None and workflow is not None:
        project = getattr(workflow, "project", None)
    return AutomationAuditLog.objects.create(
        project=project,
        rule=rule,
        rule_name=getattr(rule, "name", "") or "",
        workflow=workflow,
        workflow_name=getattr(workflow, "name", "") or "",
        trigger_event=trigger_event or getattr(rule, "trigger_event", ""),
        entity_type=entity_type,
        entity_id=entity_id,
        entity_code=entity_code,
        actor=actor,
        actor_name=actor_name,
        actor_role=actor_role,
        executed_at=timezone.now(),
        duration_ms=duration_ms,
        status=status,
        step_logs=step_logs or [],
        action_logs=action_logs or [],
    )
