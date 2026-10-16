"""
Automation services for business logic.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from django.utils import timezone


def _resolve_workflow(workflow_id: Any):
    """Resolve a client-supplied workflow id to a workflow, else None."""
    from apps.production.models import Workflow

    if not workflow_id:
        return None
    try:
        workflow_uuid = UUID(str(workflow_id))
    except (ValueError, AttributeError, TypeError):
        # Mock-style ids (e.g. "wf-001") never resolve — never trust them.
        return None
    return Workflow.objects.filter(id=workflow_uuid).first()


def create_rule(
    *,
    user,
    data: dict[str, Any],
    project=None,
):
    """Create an automation rule, optionally scoped to a project."""
    from apps.production.models import AutomationRule

    workflow = _resolve_workflow(data.get("workflow_id"))
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
    )


def update_rule(
    *,
    rule,
    data: dict[str, Any],
):
    """Update an automation rule (partial or full)."""
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
    if "workflow_id" in data:
        rule.workflow = _resolve_workflow(data.get("workflow_id"))
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
