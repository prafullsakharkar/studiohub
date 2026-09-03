"""
Publishing service for business logic.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

from django.db import transaction

if TYPE_CHECKING:
    from apps.publishing.models import PublishItem


def create_publish_item(
    *,
    name: str,
    code: str,
    organization_id: str,
    project_id: str | None = None,
    entity_type: str,
    entity_id: str,
    entity_code: str,
    entity_name: str,
    dcc_tool: str,
    dcc_version: str = "",
    source_file: str = "",
    source_version: str = "",
    export_path: str = "",
    export_format: str = "",
    created_by_id: str | None = None,
) -> PublishItem:
    """Create a new publish item."""
    from apps.organization.models import Organization
    from apps.publishing.models import PublishItem
    
    org = Organization.objects.get(id=organization_id)
    
    publish = PublishItem.objects.create(
        name=name,
        code=code,
        organization=org,
        project_id=project_id,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_code=entity_code,
        entity_name=entity_name,
        dcc_tool=dcc_tool,
        dcc_version=dcc_version,
        source_file=source_file,
        source_version=source_version,
        export_path=export_path,
        export_format=export_format,
        created_by_id=created_by_id,
    )
    
    return publish


@transaction.atomic
def validate_publish(
    *,
    publish_id: str,
    user_id: str,
    organization_id: str,
) -> dict:
    """Run validation on a publish item."""
    from apps.audit.models import AuditLog
    from apps.publishing.models import PublishItem, PublishValidationRule
    
    publish = PublishItem.objects.get(
        id=publish_id,
        organization_id=organization_id,
    )
    
    # Get active validation rules scoped to the organization
    rules = PublishValidationRule.objects.filter(
        organization_id=organization_id,
        is_active=True,
    ).order_by("order")
    
    validation_results = []
    all_passed = True
    
    for rule in rules:
        result = {
            "rule_id": str(rule.id),
            "rule_name": rule.name,
            "rule_type": rule.rule_type,
            "passed": True,
            "message": "Passed",
        }
        
        # Simulate rule execution (in production, this would run actual validation)
        if rule.rule_type == PublishValidationRule.RULE_FILE_EXISTS:
            result["passed"] = bool(publish.source_file and publish.source_file != "")
            if not result["passed"]:
                result["message"] = "Source file not found"
                all_passed = False
        
        elif rule.rule_type == PublishValidationRule.RULE_FILE_SIZE:
            result["passed"] = True  # Simulated
            if not result["passed"]:
                result["message"] = "File size exceeds limit"
                all_passed = False
        
        elif rule.rule_type == PublishValidationRule.RULE_FRAME_RANGE:
            result["passed"] = True  # Simulated
            if not result["passed"]:
                result["message"] = "Frame range invalid"
                all_passed = False
        
        validation_results.append(result)
    
    # Update publish status
    if all_passed:
        publish.status = PublishItem.STATUS_VALIDATED
        publish.validation_results = {
            "passed": True,
            "results": validation_results,
        }
    else:
        publish.status = PublishItem.STATUS_FAILED
        publish.validation_results = {
            "passed": False,
            "results": validation_results,
        }
        publish.error_message = "Validation failed"
    
    publish.save(update_fields=["status", "validation_results", "error_message"])
    
    # Create audit log
    AuditLog.objects.create(
        action=AuditLog.ACTION_UPDATE,
        target_type=AuditLog.TARGET_VIDEO,  # Reusing for publishing
        target_id=str(publish_id),
        target_name=publish.name,
        description=f"Publish {publish.code} validated: {'Passed' if all_passed else 'Failed'}",
        actor_id=user_id,
        organization=publish.organization,
        metadata={"validation_results": validation_results, "all_passed": all_passed},
    )
    
    return {
        "success": True,
        "publish_id": str(publish_id),
        "status": publish.status,
        "validation_results": validation_results,
        "all_passed": all_passed,
    }


@transaction.atomic
def republish(
    *,
    publish_id: str,
    user_id: str,
    organization_id: str,
) -> PublishItem:
    """Create a new iteration of a publish."""
    from apps.audit.models import AuditLog
    from apps.publishing.models import PublishItem
    
    original = PublishItem.objects.get(
        id=publish_id,
        organization_id=organization_id,
    )
    
    # Increment version
    new_code = f"{original.code}_v{original.retry_count + 2}"
    
    publish = PublishItem.objects.create(
        name=original.name,
        code=new_code,
        organization=original.organization,
        project=original.project,
        entity_type=original.entity_type,
        entity_id=original.entity_id,
        entity_code=original.entity_code,
        entity_name=original.entity_name,
        dcc_tool=original.dcc_tool,
        dcc_version=original.dcc_version,
        source_file=original.source_file,
        source_version=f"{original.source_version}+1" if original.source_version else "v2",
        export_path=original.export_path,
        export_format=original.export_format,
        status=PublishItem.STATUS_PENDING,
        retry_count=original.retry_count + 1,
        created_by_id=user_id,
    )
    
    # Create audit log
    AuditLog.objects.create(
        action=AuditLog.ACTION_CREATE,
        target_type=AuditLog.TARGET_VIDEO,
        target_id=str(publish.id),
        target_name=publish.name,
        description=f"New publish iteration created from {original.code}",
        actor_id=user_id,
        organization=publish.organization,
        metadata={"original_publish_id": str(publish_id), "iteration": publish.retry_count + 1},
    )
    
    return publish


@transaction.atomic
def unpublish(
    *,
    publish_id: str,
    user_id: str,
    organization_id: str,
) -> PublishItem:
    """Deprecate and unlink a publish."""
    from apps.audit.models import AuditLog
    from apps.publishing.models import PublishItem
    
    publish = PublishItem.objects.get(
        id=publish_id,
        organization_id=organization_id,
    )
    
    publish.status = PublishItem.STATUS_CANCELLED
    publish.is_archived = True
    publish.save(update_fields=["status", "is_archived"])
    
    # Create audit log
    AuditLog.objects.create(
        action=AuditLog.ACTION_DELETE,
        target_type=AuditLog.TARGET_VIDEO,
        target_id=str(publish_id),
        target_name=publish.name,
        description=f"Publish {publish.code} deprecated and unlinked",
        actor_id=user_id,
        organization=publish.organization,
    )
    
    return publish


@transaction.atomic
def retry_publish(
    *,
    publish_id: str,
    user_id: str,
    organization_id: str,
) -> PublishItem:
    """Re-trigger a failed publish."""
    from apps.audit.models import AuditLog
    from apps.publishing.models import PublishItem
    
    publish = PublishItem.objects.get(
        id=publish_id,
        organization_id=organization_id,
    )
    
    if publish.status != PublishItem.STATUS_FAILED:
        raise ValueError("Only failed publishes can be retried")
    
    publish.status = PublishItem.STATUS_PENDING
    publish.error_message = ""
    publish.retry_count = publish.retry_count + 1
    publish.save(update_fields=["status", "error_message", "retry_count"])
    
    # Create audit log
    AuditLog.objects.create(
        action=AuditLog.ACTION_UPDATE,
        target_type=AuditLog.TARGET_VIDEO,
        target_id=str(publish_id),
        target_name=publish.name,
        description=f"Publish {publish.code} retried (attempt {publish.retry_count + 1})",
        actor_id=user_id,
        organization=publish.organization,
    )
    
    return publish
