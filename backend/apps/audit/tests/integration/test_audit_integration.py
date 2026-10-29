"""
Integration tests for Audit application workflows.
"""

from __future__ import annotations

import pytest

from apps.audit.models.append_only import ImmutableRecordError
from apps.audit.models.audit_log import AuditLog
from apps.audit.selectors.audit_log import AuditLogSelector
from apps.audit.services.audit_log import AuditLogService
from apps.audit.tests.factories import AuditLogFactory


class TestAuditWorkflow:
    """Integration tests for audit workflows."""

    @pytest.mark.django_db
    def test_create_audit_log_workflow(self) -> None:
        """Create an audit log through the service and verify persistence."""
        log = AuditLogService.create_log(
            action=AuditLog.ACTION_CREATE,
            severity="info",
            target_type="user",
            target_id="u-1",
            description="User created",
        )
        assert log.id is not None
        assert AuditLog.objects.filter(id=log.id).exists()

    @pytest.mark.django_db
    def test_update_audit_log_workflow(self) -> None:
        """A recorded audit log cannot be changed, even through the service (TM-011)."""
        log = AuditLogFactory(description="before")
        with pytest.raises(ImmutableRecordError):
            AuditLogService.update_log(log, description="after")
        log.refresh_from_db()
        assert log.description == "before"

    @pytest.mark.django_db
    def test_audit_log_query_workflow(self) -> None:
        """Query audit logs through the selector."""
        log = AuditLogFactory()
        retrieved = AuditLogSelector.get_by_id(log.id)
        assert retrieved.id == log.id

    @pytest.mark.django_db
    def test_soft_delete_workflow(self) -> None:
        """An audit log cannot be deleted through the service (TM-011)."""
        log = AuditLogFactory()
        with pytest.raises(ImmutableRecordError):
            AuditLogService.delete_log(log)
        assert AuditLog.objects.filter(id=log.id).exists()
