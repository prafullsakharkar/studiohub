"""
Integration tests for Audit application workflows.
"""

from __future__ import annotations

import pytest

from apps.audit.models.audit_log import AuditLog
from apps.audit.selectors.audit_log import AuditLogSelector
from apps.audit.services.audit_log import AuditLogService
from apps.audit.tests.factories import AuditLogFactory
from apps.organization.tests.factories import OrganizationFactory


class TestAuditWorkflow:
    """Integration tests for audit workflows."""

    @pytest.mark.django_db
    def test_create_audit_log_workflow(self) -> None:
        """Create an audit log through the service and verify persistence."""
        organization = OrganizationFactory()
        log = AuditLogService.create_log(
            action=AuditLog.ACTION_CREATE,
            severity="info",
            target_type="user",
            target_id="u-1",
            organization=organization,
            description="User created",
        )
        assert log.id is not None
        assert AuditLog.objects.filter(id=log.id).exists()

    @pytest.mark.django_db
    def test_update_audit_log_workflow(self) -> None:
        """Update an audit log through the service."""
        log = AuditLogFactory(description="before")
        updated = AuditLogService.update_log(
            log,
            description="after",
        )
        updated.refresh_from_db()
        assert updated.description == "after"

    @pytest.mark.django_db
    def test_audit_log_query_workflow(self) -> None:
        """Query audit logs through the selector."""
        log = AuditLogFactory()
        retrieved = AuditLogSelector.get_by_id(log.id)
        assert retrieved.id == log.id

    @pytest.mark.django_db
    def test_audit_log_by_organization(self) -> None:
        """Selector scopes audit logs by organization."""
        organization = OrganizationFactory()
        log = AuditLogFactory(organization=organization)
        qs = AuditLogSelector.by_organization(organization.id)
        assert log in qs

    @pytest.mark.django_db
    def test_soft_delete_workflow(self) -> None:
        """Deleting an audit log removes it from the default queryset."""
        log = AuditLogFactory()
        AuditLogService.delete_log(log)
        assert not AuditLog.objects.filter(id=log.id).exists()
