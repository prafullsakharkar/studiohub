# tests/services/test_audit_services.py
"""
Service tests for Audit application.
"""

from __future__ import annotations

import pytest

from apps.audit.models.audit_log import AuditLog
from apps.audit.services.audit_log import AuditLogService
from apps.audit.tests.factories import AuditLogFactory


class TestAuditLogService:
    """Tests for AuditLog service."""

    @pytest.mark.django_db
    def test_service_create_audit_log(self, organization, user) -> None:
        """Test service create_log method."""
        audit_log = AuditLogService.create_log(
            organization=organization,
            actor=user,
            action=AuditLog.ACTION_CREATE,
            target_type="TestModel",
            target_id="123",
            target_name="Test",
            description="Created",
            ip_address="127.0.0.1",
            user_agent="pytest",
        )
        assert audit_log.uuid is not None
        assert audit_log.action == AuditLog.ACTION_CREATE
        assert audit_log.target_type == "TestModel"
        assert audit_log.actor_id == user.id

    @pytest.mark.django_db
    def test_service_update_audit_log(self, audit_log: AuditLog) -> None:
        """Test service update_log method."""
        updated = AuditLogService.update_log(
            audit_log, description="Updated description"
        )
        assert updated.description == "Updated description"
        assert AuditLog.objects.get(id=audit_log.id).description == (
            "Updated description"
        )

    @pytest.mark.django_db
    def test_service_delete_audit_log(self, audit_log: AuditLog) -> None:
        """Test service delete_log method."""
        AuditLogService.delete_log(audit_log)
        assert AuditLog.objects.filter(id=audit_log.id).count() == 0
